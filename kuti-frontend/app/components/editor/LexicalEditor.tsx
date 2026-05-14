import { useEffect, useCallback, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode, 
  type EditorState,
  type LexicalNode,
} from 'lexical';
import { ParagraphNode, TextNode } from 'lexical';

interface LexicalEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  id?: string;
}

// Configuration minimale
const editorConfig = {
  namespace: 'kuti-editor',
  theme: {
    paragraph: 'editor-paragraph',
  },
  nodes: [ParagraphNode, TextNode],
  onError: (error: Error) => {
    console.error('Lexical error:', error);
  },
};

// Plugin pour charger le contenu initial UNE SEULE FOIS
function InitialValuePlugin({ initialValue }: { initialValue: string }) {
  const [editor] = useLexicalComposerContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Ne charger que la première fois
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      // Parser le texte en paragraphes
      const lines = initialValue.split('\n');
      for (const line of lines) {
        const paragraph = $createParagraphNode();
        if (line) {
          paragraph.append($createTextNode(line));
        }
        root.append(paragraph);
      }
    });
  }, [editor]); // Ne pas dépendre de initialValue pour éviter les rechargements

  return null;
}

// Plugin pour émettre les changements
function CustomOnChangePlugin({ onChange }: { onChange: (value: string) => void }) {
  const [editor] = useLexicalComposerContext();

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const paragraphs: string[] = [];
        
        root.getChildren().forEach((paragraph: LexicalNode) => {
          if (paragraph.getType() === 'paragraph') {
            const text = paragraph.getTextContent();
            paragraphs.push(text);
          }
        });
        
        onChange(paragraphs.join('\n'));
      });
    },
    [onChange]
  );

  return <OnChangePlugin onChange={handleChange} />;
}

export function LexicalEditor({
  initialValue,
  onChange,
  placeholder = 'Écrivez...',
  minHeight = '200px',
  id,
}: LexicalEditorProps) {
  return (
    <div className="lexical-editor-wrapper" style={{ minHeight }} id={id}>
      <LexicalComposer initialConfig={editorConfig}>
        <div className="lexical-editor-container">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-content-editable"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="lexical-placeholder">{placeholder}</div>
                }
              />
            }
            ErrorBoundary={({ children }) => <div>{children}</div>}
          />
          <HistoryPlugin />
          <InitialValuePlugin initialValue={initialValue} />
          <CustomOnChangePlugin onChange={onChange} />
        </div>
      </LexicalComposer>
    </div>
  );
}
