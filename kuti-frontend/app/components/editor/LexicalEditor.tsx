import { useEffect, useCallback, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type EditorState,
  type LexicalNode,
} from 'lexical';
import { ParagraphNode, TextNode } from 'lexical';
import {
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import {
  ListNode,
  ListItemNode,
} from '@lexical/list';
import {
  LinkNode,
  AutoLinkNode,
} from '@lexical/link';
import {
  TRANSFORMERS,
} from '@lexical/markdown';
import { EditorToolbar } from './EditorToolbar';

interface LexicalEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  id?: string;
}

// Extended configuration with rich text support
const editorConfig = {
  namespace: 'kuti-editor',
  theme: {
    paragraph: 'editor-paragraph',
    heading: {
      h1: 'editor-h1',
      h2: 'editor-h2',
      h3: 'editor-h3',
    },
    list: {
      ul: 'editor-ul',
      ol: 'editor-ol',
    },
    listitem: 'editor-listitem',
    quote: 'editor-quote',
    code: 'editor-code',
    link: 'editor-link',
  },
  nodes: [
    ParagraphNode,
    TextNode,
    HeadingNode,
    QuoteNode,
    CodeNode,
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
  ],
  onError: (error: Error) => {
    console.error('Lexical error:', error);
  },
};

// Plugin pour charger le contenu initial UNE SEULE FOIS
function InitialValuePlugin({ initialValue }: { initialValue: string }) {
  const [editor] = useLexicalComposerContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      // Parse text into paragraphs
      const lines = initialValue.split('\n');
      for (const line of lines) {
        const paragraph = $createParagraphNode();
        if (line) {
          paragraph.append($createTextNode(line));
        }
        root.append(paragraph);
      }
    });
  }, [editor]);

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
        
        root.getChildren().forEach((node: LexicalNode) => {
          paragraphs.push(node.getTextContent());
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
          <EditorToolbar />
          <div className="lexical-editor-content" style={{ minHeight: `calc(${minHeight} - 48px)` }}>
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
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TabIndentationPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <InitialValuePlugin initialValue={initialValue} />
          <CustomOnChangePlugin onChange={onChange} />
        </div>
      </LexicalComposer>
    </div>
  );
}
