import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import { createReactMathBlockSpec, createReactInlineMathSpec } from "@blocknote/math-block";

const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        math: createReactMathBlockSpec(),
    },
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        math: createReactInlineMathSpec(),
    },
});

import { BlockNoteEditor } from "@blocknote/core";

const editor = BlockNoteEditor.create({ schema });
editor.replaceBlocks(editor.document, [
  { type: "paragraph", content: "Before" },
  { type: "math", props: { math: "E = mc^2" } },
  { type: "paragraph", content: [{ type: "text", text: "Inline: ", styles: {} }, { type: "math", props: { math: "x^2" } }] }
]);

editor.blocksToFullHTML(editor.document).then(html => console.log(html));

