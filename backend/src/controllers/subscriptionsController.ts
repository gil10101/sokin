/**
 * Subscriptions Controller
 *
 * Handles CRUD operations for user subscriptions with validation,
 * authorization, and consistent error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { Subscription } from '../models/types';
import { normalizeDateFields } from '../utils/firestore';

const normalizeIsoDate = (value: unknown, fieldName: string): string => {
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName} date`, 400, true);
  }
  return date.toISOString();
};

const normalizeSubscription = (subscription: Subscription): Subscription => normalizeDateFields(
  subscription,
  ['startDate', 'nextPaymentDate', 'createdAt', 'updatedAt']
);

export const getSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const snapshot = await db
      .collection('subscriptions')
      .where('userId', '==', req.user.uid)
      .orderBy('nextPaymentDate', 'asc')
      .get();

    const subscriptions = snapshot.docs.map((doc) => normalizeSubscription({
      id: doc.id,
      ...doc.data()
    } as Subscription));

    res.status(200).json({ success: true, data: subscriptions });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching subscriptions', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch subscriptions', 500, false));
  }
};

export const createSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const {
      name,
      logo,
      amount,
      billingCycle,
      customInterval,
      customIntervalUnit,
      startDate,
      nextPaymentDate,
      paymentMethod,
      website,
      notes,
      autoRenew,
      category
    } = req.body;

    if (billingCycle === 'custom') {
      if (!customInterval || !customIntervalUnit) {
        throw new AppError('Custom interval and unit are required for custom billing cycles', 400, true);
      }
    }

    const subscriptionData: Omit<Subscription, 'id'> = {
      userId: req.user.uid,
      name: name.trim(),
      logo: logo || undefined,
      amount: Number(amount),
      billingCycle,
      customInterval,
      customIntervalUnit,
      startDate: normalizeIsoDate(startDate, 'start'),
      nextPaymentDate: normalizeIsoDate(nextPaymentDate, 'next payment'),
      paymentMethod: paymentMethod.trim(),
      website: website || null,
      notes: notes ?? null,
      autoRenew: Boolean(autoRenew),
      category: category.trim(),
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('subscriptions').add(subscriptionData);

    res.status(201).json({
      success: true,
      data: normalizeSubscription({ id: docRef.id, ...subscriptionData })
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to create subscription', 500, false));
  }
};

export const updateSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const subscriptionId = req.params.id;
    const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();

    if (!subscriptionDoc.exists) {
      throw new AppError('Subscription not found', 404, true);
    }

    const subscriptionData = subscriptionDoc.data() as Subscription;
    if (subscriptionData.userId !== req.user.uid) {
      throw new AppError('Forbidden: You do not have access to this subscription', 403, true);
    }

    const updateData: Partial<Subscription> & { updatedAt: string } = {
      updatedAt: new Date().toISOString()
    };

    const fields = req.body as Partial<Subscription>;

    if (fields.name !== undefined) updateData.name = fields.name.trim();
    if (fields.logo !== undefined) updateData.logo = fields.logo || undefined;
    if (fields.amount !== undefined) updateData.amount = Number(fields.amount);
    if (fields.billingCycle !== undefined) updateData.billingCycle = fields.billingCycle;
    if (fields.customInterval !== undefined) updateData.customInterval = fields.customInterval;
    if (fields.customIntervalUnit !== undefined) updateData.customIntervalUnit = fields.customIntervalUnit;
    if (fields.startDate !== undefined) updateData.startDate = normalizeIsoDate(fields.startDate, 'start');
    if (fields.nextPaymentDate !== undefined) updateData.nextPaymentDate = normalizeIsoDate(fields.nextPaymentDate, 'next payment');
    if (fields.paymentMethod !== undefined) updateData.paymentMethod = fields.paymentMethod.trim();
    if (fields.website !== undefined) updateData.website = fields.website || null;
    if (fields.notes !== undefined) updateData.notes = fields.notes ?? null;
    if (fields.autoRenew !== undefined) updateData.autoRenew = Boolean(fields.autoRenew);
    if (fields.category !== undefined) updateData.category = fields.category.trim();

    await db.collection('subscriptions').doc(subscriptionId).update(updateData);

    res.status(200).json({
      success: true,
      data: normalizeSubscription({
        id: subscriptionId,
        ...subscriptionData,
        ...updateData
      } as Subscription)
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId: req.params.id,
      userId: req.user?.uid
    });
    next(new AppError('Failed to update subscription', 500, false));
  }
};

export const deleteSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const subscriptionId = req.params.id;
    const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();

    if (!subscriptionDoc.exists) {
      throw new AppError('Subscription not found', 404, true);
    }

    const subscriptionData = subscriptionDoc.data() as Subscription;
    if (subscriptionData.userId !== req.user.uid) {
      throw new AppError('Forbidden: You do not have access to this subscription', 403, true);
    }

    await db.collection('subscriptions').doc(subscriptionId).delete();

    res.status(200).json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting subscription', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId: req.params.id,
      userId: req.user?.uid
    });
    next(new AppError('Failed to delete subscription', 500, false));
  }
};

