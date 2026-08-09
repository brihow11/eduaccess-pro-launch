import { useState, useRef, useEffect } from 'react';
import { Edit2 } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
  previewMode: boolean;
}

export default function EditableText({
  value,
  onChange,
  className = '',
  multiline = false,
  previewMode
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  // Only allow editing in development/editor environment
  const isEditorEnvironment = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (!previewMode || !isEditorEnvironment) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    const baseInputClasses = "bg-white border-2 border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600";

    if (multiline) {
      return (
        <span className="editable-text-wrapper" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className={`${className} ${baseInputClasses} resize-none`}
            rows={3}
          />
        </span>
      );
    }

    return (
      <span className="editable-text-wrapper" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className={`${className} ${baseInputClasses} w-full text-center`}
        />
      </span>
    );
  }

  return (
    <span
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`${className} editable-text-wrapper cursor-pointer hover:bg-blue-50 hover:outline hover:outline-2 hover:outline-blue-300 rounded px-2 py-1 inline-flex items-center gap-2 transition-all relative group`}
    >
      {value}
      <Edit2 className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -right-6" />
    </span>
  );
}
