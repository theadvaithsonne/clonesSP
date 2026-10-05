"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
  className?: string
  onOpen?: () => void
}

export const SearchableSelect = ({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled = false,
  className = "",
  onOpen,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const filteredOptions = options.filter((option) => 
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleSelect = (selectedValue: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onValueChange(selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!open && onOpen) {
            onOpen();
          }
          setOpen(!open);
        }}
        disabled={disabled}
        className={`
          w-full flex justify-between items-center
          px-3 py-2 border border-gray-300 rounded text-sm
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}
        `}
      >
        {value ? options.find((option) => option.value === value)?.label : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="
          absolute z-10 mt-1 w-full
          bg-white border border-gray-300 rounded shadow
        ">
          <div className="p-2 border-b border-gray-300">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="
                w-full px-3 py-2 border border-gray-300 rounded text-sm
                focus:outline-none
              "
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No results found</div>
            ) : (
              <ul>
                {filteredOptions.map((option) => (
                  <li
                    key={option.value}
                    onClick={(e) => handleSelect(option.value, e)}
                    className={`
                      px-4 py-2 cursor-pointer text-sm
                      hover:bg-gray-100
                      ${value === option.value ? 'bg-gray-200' : ''}
                    `}
                  >
                    <div className="flex items-center">
                      <Check 
                        className={`mr-2 h-4 w-4 ${value === option.value ? 'opacity-100' : 'opacity-0'}`} 
                      />
                      {option.label}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}