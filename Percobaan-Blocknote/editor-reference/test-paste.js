function processInlineMath(content) {
    if (!content || !Array.isArray(content)) return content;
    
    const newContent = [];
    const inlineMathRegex = /(\$[^ \$\n](?:[^\$]*[^ \$\n])?\$)/g;
    
    for (const item of content) {
        if (item.type === "text" && item.text && item.text.includes("$")) {
            const parts = item.text.split(inlineMathRegex);
            for (const part of parts) {
                if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
                    newContent.push({
                        type: "math",
                        content: part.substring(1, part.length - 1)
                    });
                } else if (part.length > 0) {
                    newContent.push({
                        ...item,
                        text: part
                    });
                }
            }
        } else {
            newContent.push(item);
        }
    }
    return newContent;
}

const mockContent = [
    { type: "text", text: "kalau $E$ adalah efisiensi, $O$ adalah output" }
];
console.log(JSON.stringify(processInlineMath(mockContent), null, 2));
