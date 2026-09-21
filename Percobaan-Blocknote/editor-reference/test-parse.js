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

const markdown = "Hello $E$ world and block: \n\n$$\nE = mc^2\n$$\n";
const blocks = await editor.tryParseMarkdownToBlocks(markdown);
console.log(JSON.stringify(blocks, null, 2));

