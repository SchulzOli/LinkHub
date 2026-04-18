import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import styles from './SelectMenu.module.css'

export type SelectMenuOption = {
  description?: string
  label: string
  value: string
}

type SelectMenuProps = {
  ariaLabel: string
  className?: string
  disabled?: boolean
  onChange: (value: string) => void
  options: ReadonlyArray<SelectMenuOption>
  value: string
}

const SELECT_MENU_PORTAL_ATTRIBUTE = 'data-select-menu-portal'

export function isSelectMenuPortalTarget(target: EventTarget | null) {
  return target instanceof Element
    ? Boolean(target.closest(`[${SELECT_MENU_PORTAL_ATTRIBUTE}="true"]`))
    : false
}

export function SelectMenu({
  ariaLabel,
  className,
  disabled = false,
  onChange,
  options,
  value,
}: SelectMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const listboxId = useId()
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selectedOption = options[selectedIndex] ?? options[0]

  const focusOption = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, options.length - 1))

      setActiveIndex(nextIndex)
      window.requestAnimationFrame(() => {
        optionRefs.current[nextIndex]?.focus()
      })
    },
    [options.length],
  )

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const viewportPadding = 8
    const offset = 8
    const preferredMaxHeight = 280
    const minimumHeight = 120
    const spaceBelow =
      window.innerHeight - rect.bottom - viewportPadding - offset
    const spaceAbove = rect.top - viewportPadding - offset
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow
    const availableHeight = openUpward ? spaceAbove : spaceBelow
    const maxHeight = Math.max(
      0,
      Math.min(preferredMaxHeight, Math.max(minimumHeight, availableHeight)),
    )
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - rect.width - viewportPadding),
    )

    setMenuStyle({
      left: `${left}px`,
      width: `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
      ...(openUpward
        ? { bottom: `${window.innerHeight - rect.top + offset}px` }
        : { top: `${rect.bottom + offset}px` }),
    })
  }, [])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
  }, [])

  const commitValue = useCallback(
    (nextValue: string) => {
      onChange(nextValue)
      setIsOpen(false)
      triggerRef.current?.focus()
    },
    [onChange],
  )

  useEffect(() => {
    setActiveIndex(selectedIndex)
  }, [selectedIndex])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    updateMenuPosition()

    const handleViewportChange = () => {
      updateMenuPosition()
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    focusOption(selectedIndex)

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null

      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }

      closeMenu()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, focusOption, isOpen, selectedIndex])

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (disabled || options.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex(selectedIndex)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex(selectedIndex)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((current) => !current)
    }
  }

  return (
    <div
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      data-select-root="true"
    >
      <button
        ref={triggerRef}
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        disabled={disabled}
        type="button"
        onClick={() => {
          if (disabled || options.length === 0) {
            return
          }

          setIsOpen((current) => !current)
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.label}>{selectedOption?.label ?? ''}</span>
        <span aria-hidden="true" className={styles.chevron}>
          <svg
            viewBox="0 0 16 16"
            focusable="false"
            className={styles.chevronSvg}
          >
            <path
              d="M3.47 5.97a.75.75 0 0 1 1.06 0L8 9.44l3.47-3.47a.75.75 0 1 1 1.06 1.06L8.53 11.03a.75.75 0 0 1-1.06 0L3.47 7.03a.75.75 0 0 1 0-1.06Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </button>
      {isOpen && typeof document !== 'undefined' && menuStyle
        ? createPortal(
            <div
              className={styles.portal}
              data-select-menu-portal="true"
              style={menuStyle}
              onWheelCapture={(event) => {
                event.stopPropagation()
              }}
            >
              <div
                ref={menuRef}
                aria-label={ariaLabel}
                className={styles.menu}
                id={listboxId}
                role="listbox"
              >
                {options.map((option, index) => {
                  const isSelected = option.value === value
                  const isActive = index === activeIndex

                  return (
                    <button
                      key={option.value}
                      ref={(node) => {
                        optionRefs.current[index] = node
                      }}
                      aria-selected={isSelected}
                      className={`${styles.option} ${isSelected ? styles.optionSelected : ''} ${isActive ? styles.optionActive : ''}`}
                      role="option"
                      tabIndex={isActive ? 0 : -1}
                      type="button"
                      onClick={() => commitValue(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                          event.preventDefault()
                          focusOption(index + 1)
                          return
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault()
                          focusOption(index - 1)
                          return
                        }

                        if (event.key === 'Home') {
                          event.preventDefault()
                          focusOption(0)
                          return
                        }

                        if (event.key === 'End') {
                          event.preventDefault()
                          focusOption(options.length - 1)
                          return
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          closeMenu()
                          triggerRef.current?.focus()
                          return
                        }

                        if (event.key === 'Tab') {
                          closeMenu()
                          return
                        }

                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          commitValue(option.value)
                        }
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={styles.optionRow}>
                        <span className={styles.optionLabel}>
                          {option.label}
                        </span>
                        {isSelected ? (
                          <span aria-hidden="true" className={styles.check}>
                            <svg
                              viewBox="0 0 16 16"
                              focusable="false"
                              className={styles.checkSvg}
                            >
                              <path
                                d="M6.3 11.1 3.7 8.5a.75.75 0 1 1 1.06-1.06l1.54 1.54 5-5a.75.75 0 1 1 1.06 1.06l-5.53 5.53a.75.75 0 0 1-1.06 0Z"
                                fill="currentColor"
                              />
                            </svg>
                          </span>
                        ) : null}
                      </span>
                      {option.description ? (
                        <span className={styles.optionDescription}>
                          {option.description}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
