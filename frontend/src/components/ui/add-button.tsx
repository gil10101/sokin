"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface AddButtonProps {
  /**
   * The label to display after "ADD" (e.g., "Budget" renders "ADD BUDGET")
   */
  label: string
  /**
   * Click handler for the button
   */
  onClick: () => void
  /**
   * Optional custom icon component. Defaults to Plus icon.
   */
  icon?: React.ReactNode
  /**
   * Optional additional className for customization
   */
  className?: string
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string
}

/**
 * Unified Add Button component with responsive design.
 * 
 * - Desktop/Tablet: Boxy rounded container with + icon and "ADD {LABEL}" text
 * - Mobile: Compact square icon-only button
 * 
 * Usage:
 * ```tsx
 * <AddButton label="Budget" onClick={() => setShowDialog(true)} />
 * <AddButton label="Expense" onClick={handleAdd} icon={<PlusCircle className="h-5 w-5" />} />
 * ```
 */
export function AddButton({
  label,
  onClick,
  icon,
  className,
  disabled = false,
  ariaLabel,
}: AddButtonProps) {
  const defaultIcon = <Plus className="h-5 w-5" />
  const iconElement = icon || defaultIcon

  // Single button with responsive styling for proper accessibility
  // Screen readers will only see one button regardless of viewport
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || `Add ${label}`}
      className={cn(
        "bg-cream text-dark hover:bg-cream/90",
        "rounded-lg",
        "flex items-center justify-center",
        "font-medium",
        "transition-all duration-200",
        "shadow-sm hover:shadow-md",
        // Mobile: compact square button
        "h-10 w-10 p-0 md:h-11 md:w-auto md:px-5",
        // Desktop: add gap for text
        "md:gap-2",
        className
      )}
    >
      {/* Icon with responsive sizing */}
      {React.isValidElement(iconElement) 
        ? React.cloneElement(iconElement as React.ReactElement<{ className?: string }>, { 
            className: "h-5 w-5 md:h-4 md:w-4" 
          })
        : <Plus className="h-5 w-5 md:h-4 md:w-4" />}
      {/* Label hidden on mobile, visible on desktop */}
      <span className="sr-only md:not-sr-only md:uppercase md:text-sm md:tracking-wide">
        Add {label}
      </span>
    </Button>
  )
}

/**
 * Variant of AddButton that uses a dropdown menu for multiple add options.
 * Useful for pages like Net Worth that need to add different item types.
 */
interface AddButtonDropdownProps {
  /**
   * The primary label shown on the button (e.g., "Item")
   */
  label?: string
  /**
   * Menu items to display in the dropdown
   */
  children: React.ReactNode
  /**
   * Optional additional className for customization
   */
  className?: string
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
}

/**
 * AddButtonDropdown - wrapper component for dropdown menus
 * 
 * Note: This is a passthrough component that allows consumers to provide
 * their own DropdownMenu structure. The label, className, and disabled props
 * are available for future implementations that render a trigger button.
 * 
 * @example
 * <AddButtonDropdown label="Item">
 *   <DropdownMenu>
 *     <DropdownMenuTrigger>...</DropdownMenuTrigger>
 *     <DropdownMenuContent>...</DropdownMenuContent>
 *   </DropdownMenu>
 * </AddButtonDropdown>
 */
export function AddButtonDropdown({
  children,
}: AddButtonDropdownProps) {
  // This component is a passthrough wrapper - consumers provide the full dropdown structure
  // The label, className, and disabled props are intentionally available in the interface
  // for API consistency and potential future use
  return <>{children}</>
}

export default AddButton

