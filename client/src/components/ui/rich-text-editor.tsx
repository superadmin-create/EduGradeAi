import { useState, useRef, useEffect } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  className,
  "data-testid": testId,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const formatButtons = [
    { command: "bold", icon: Bold, label: "Bold" },
    { command: "italic", icon: Italic, label: "Italic" },
    { command: "underline", icon: Underline, label: "Underline" },
    { command: "insertUnorderedList", icon: List, label: "Bullet List" },
    { command: "insertOrderedList", icon: ListOrdered, label: "Numbered List" },
  ];

  return (
    <div className={cn("rich-editor border border-border rounded-lg", className)}>
      {isFocused && (
        <div className="flex items-center space-x-1 p-2 border-b border-border">
          {formatButtons.map((button) => {
            const Icon = button.icon;
            return (
              <Button
                key={button.command}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => execCommand(button.command)}
                className="h-8 w-8 p-0"
                title={button.label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      )}
      
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "min-h-[120px] p-3 outline-none bg-background text-foreground",
          !value && "text-muted-foreground"
        )}
        data-placeholder={placeholder}
        style={{
          whiteSpace: "pre-wrap",
        }}
        data-testid={testId}
        dangerouslySetInnerHTML={{ __html: value || "" }}
      />
      
      {!value && !isFocused && (
        <div className="absolute inset-0 p-3 pointer-events-none text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  );
}
