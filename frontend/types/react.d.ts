import 'react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

// Fix ReactNode to exclude bigint for React 19 compatibility
declare module 'react' {
  type ReactNodeWithoutBigInt =
    | React.ReactElement
    | string
    | number
    | React.ReactFragment
    | React.ReactPortal
    | boolean
    | null
    | undefined;

  // Override ReactNode to exclude bigint
  export type ReactNode = ReactNodeWithoutBigInt;

  // Fix JSX.Element children type
  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }

  // Fix JSX transform for React 19
  export namespace JSX {
    interface Element extends ReactElement {}
    interface ElementType extends React.ElementType {}
    interface ElementClass extends React.ComponentClass<any> {}
    interface ElementAttributesProperty { props: {} }
    interface ElementChildrenAttribute extends React.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends React.Attributes {}
    interface IntrinsicElements extends React.DOMElements {}
  }
}

// Global type fixes for Radix UI components with React 19
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any, any> {}
    interface ElementAttributesProperty { props: {} }
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes extends React.Attributes {}
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}
  }
}

// Fix ForwardRef components to be compatible with JSX
declare module 'react' {
  // Override ForwardRefExoticComponent to be JSX compatible
  export interface ForwardRefExoticComponent<P, R> {
    (props: P & { ref?: React.Ref<R> }): React.ReactElement | null;
    readonly $$typeof: symbol;
    displayName?: string;
  }
}