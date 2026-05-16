import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
} from 'lexical';
import {
  $isListNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
  $isHeadingNode,
  $createHeadingNode,
} from '@lexical/rich-text';
import {
  $wrapNodes,
} from '@lexical/selection';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  Undo,
  Redo,
} from 'lucide-react';

export function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update toolbar state based on selection
  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const formats = new Set<string>();
      
      // Text formats
      if (selection.hasFormat('bold')) formats.add('bold');
      if (selection.hasFormat('italic')) formats.add('italic');
      if (selection.hasFormat('underline')) formats.add('underline');
      if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
      if (selection.hasFormat('code')) formats.add('code');

      // Block types
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();

      if ($isHeadingNode(element)) {
        const tag = element.getTag();
        if (tag === 'h1') formats.add('h1');
        if (tag === 'h2') formats.add('h2');
        if (tag === 'h3') formats.add('h3');
      } else if ($isListNode(element)) {
        const listType = element.getListType();
        if (listType === 'bullet') formats.add('ul');
        if (listType === 'number') formats.add('ol');
      } else if (element.getType() === 'quote') {
        formats.add('quote');
      }

      setActiveFormats(formats);
    }
  }, []);

  // Register listeners
  useEffect(() => {
    // Listen for selection changes
    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });

    // Listen for undo/redo state
    const removeUndoListener = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      1
    );

    const removeRedoListener = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      1
    );

    return () => {
      removeUpdateListener();
      removeUndoListener();
      removeRedoListener();
    };
  }, [editor, updateToolbar]);

  // Format commands
  const toggleBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const toggleItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const toggleUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const toggleStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const toggleCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  const toggleHeading = (headingSize: 'h1' | 'h2' | 'h3') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getTopLevelElementOrThrow();
        
        // If already this heading, convert back to paragraph
        if ($isHeadingNode(element) && element.getTag() === headingSize) {
          $wrapNodes(selection, () => $createHeadingNode('paragraph'));
        } else {
          $wrapNodes(selection, () => $createHeadingNode(headingSize));
        }
      }
    });
  };

  const toggleBulletList = () => {
    if (activeFormats.has('ul')) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    }
  };

  const toggleNumberedList = () => {
    if (activeFormats.has('ol')) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const toggleQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Toggle quote logic would go here - simplified for now
        // This is a placeholder as quote conversion needs more complex handling
      }
    });
  };

  const handleUndo = () => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  };

  const handleRedo = () => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  };

  const ToolbarButton = ({
    onClick,
    icon: Icon,
    isActive,
    disabled,
    title,
  }: {
    onClick: () => void;
    icon: React.ComponentType<{ size?: number }>;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`toolbar-btn ${isActive ? 'active' : ''}`}
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  const Separator = () => <div className="toolbar-separator" />;

  return (
    <div className="lexical-toolbar">
      {/* Text formatting */}
      <ToolbarButton
        onClick={toggleBold}
        icon={Bold}
        isActive={activeFormats.has('bold')}
        title="Gras (Ctrl+B)"
      />
      <ToolbarButton
        onClick={toggleItalic}
        icon={Italic}
        isActive={activeFormats.has('italic')}
        title="Italique (Ctrl+I)"
      />
      <ToolbarButton
        onClick={toggleUnderline}
        icon={Underline}
        isActive={activeFormats.has('underline')}
        title="Souligné (Ctrl+U)"
      />
      <ToolbarButton
        onClick={toggleStrikethrough}
        icon={Strikethrough}
        isActive={activeFormats.has('strikethrough')}
        title="Barré"
      />

      <Separator />

      {/* Headings */}
      <ToolbarButton
        onClick={() => toggleHeading('h1')}
        icon={Heading1}
        isActive={activeFormats.has('h1')}
        title="Titre 1"
      />
      <ToolbarButton
        onClick={() => toggleHeading('h2')}
        icon={Heading2}
        isActive={activeFormats.has('h2')}
        title="Titre 2"
      />
      <ToolbarButton
        onClick={() => toggleHeading('h3')}
        icon={Heading3}
        isActive={activeFormats.has('h3')}
        title="Titre 3"
      />

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={toggleBulletList}
        icon={List}
        isActive={activeFormats.has('ul')}
        title="Liste à puces"
      />
      <ToolbarButton
        onClick={toggleNumberedList}
        icon={ListOrdered}
        isActive={activeFormats.has('ol')}
        title="Liste numérotée"
      />

      <Separator />

      {/* Quote & Code */}
      <ToolbarButton
        onClick={toggleQuote}
        icon={Quote}
        isActive={activeFormats.has('quote')}
        title="Citation"
      />
      <ToolbarButton
        onClick={toggleCode}
        icon={Code}
        isActive={activeFormats.has('code')}
        title="Code"
      />

      <Separator />

      {/* History */}
      <ToolbarButton
        onClick={handleUndo}
        icon={Undo}
        disabled={!canUndo}
        title="Annuler (Ctrl+Z)"
      />
      <ToolbarButton
        onClick={handleRedo}
        icon={Redo}
        disabled={!canRedo}
        title="Refaire (Ctrl+Y)"
      />
    </div>
  );
}
