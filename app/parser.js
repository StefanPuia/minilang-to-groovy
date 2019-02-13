/*jslint node: true, esversion: 6 */
'use strict';

module.exports = {
    parseXML     : parseXML,
    sanitizeInput: sanitizeInput
};

/**
 * parses the xml string into a tree
 * @param {String} text sanitized xml text
 * @returns list of xml elements
 */
function parseXML(text = "") {
    text = sanitizeInput(text);
    let lines = text.split("\n");
    let out = [];
    let inComment = false;
    let inScript = false;
    let inScriptSpace = 0;

    for (let i = 0; i < lines.length; i++) {
        let match = false;
        let line = lines[i].trim();
        let raw = line;
        let properties = {};

        match = line.match(/<!--(.+?)-->/);
        if (match) {
            out.push({
                number: i + 1,
                raw: raw,
                comment: match[1],
                type: "selfclose",
                tag: "comment",
                properties: properties
            });
            continue;
        }

        match = line.match(/<!--(.*)/);
        if (match && !line.match(/(.*)-->/)) {
            out.push({
                number: i + 1,
                raw: raw,
                comment: match[1],
                type: "selfclose",
                tag: "comment",
                properties: properties
            });
            inComment = true;
            continue;
        }

        match = line.match(/(.*)-->/);
        if (match) {
            out.push({
                number: i + 1,
                raw: raw,
                comment: ' ' + match[1],
                type: "selfclose",
                tag: "comment",
                properties: properties
            });
            inComment = false;
            continue;
        }

        if (inComment) {
            out.push({
                number: i + 1,
                comment: ' ' + line,
                type: "selfclose",
                tag: "comment",
                properties: properties
            });
            continue;
        }

        if (line == '</script>') {
            inScript = false;
            inScriptSpace = 0;
        }

        if (inScript) {
            out.push({
                number: i + 1,
                type: "script",
                tag: "script",
                raw: raw,
                spaces: getSpaceSize(lines[i]) - inScriptSpace - 1,
                properties: properties
            });
            continue;
        }

        if (line.match(/<[\w].+\".+\/?>/)) {
            line = line.replace(/(\w)\s*?=\s*?\"/g, '$1="');
            while (match = line.match(/\s*?([\w-:]+)="(.*?)"([\s]*?[\/>])?/)) {
                properties[match[1]] = match[2].trim();
                line = line.substr(0, match.index) + (match[3] ? match[3] : '') + line.substr(match.index + match[0].length);
            }
            match = line.match(/<([\w-]+?)\s*?\/?>/);
            if (match) {
                let type = raw.substr(raw.length - 2, 1) == "/" ? "selfclose" : "open";
                out.push({
                    number: i + 1,
                    raw: raw,
                    tag: match[1].trim(),
                    type: type,
                    properties: properties
                });
                if (match[1] == 'script' && type == 'open') {
                    inScript = true;
                    inScriptSpace = getSpaceSize(lines[i]);
                }
            } else {
                console.log(`Line match error at ${i + 1}: ${raw}`);
            }
            continue;
        }

        match = line.match(/<\/([\w-:]+?)\s*>/);
        if (match) {
            out.push({
                number: i + 1,
                raw: raw,
                tag: match[1].trim(),
                type: "close"
            });
            if (match[1] == 'script') {
                inScript = false;
                inScriptSpace = 0;
            }
            continue;
        }

        match = line.match(/<([\w-:]+?)\s*\/>/);
        if (match) {
            out.push({
                number: i + 1,
                raw: raw,
                tag: match[1].trim(),
                type: "selfclose",
                properties: properties
            });
            continue;
        }

        match = line.match(/<([\w-:]+?)\s*>/);
        if (match) {
            out.push({
                number: i + 1,
                raw: raw,
                tag: match[1].trim(),
                type: "open",
                properties: properties
            });

            if (match[1] == 'script') {
                inScript = true;
                inScriptSpace = getSpaceSize(lines[i]);
            }
            continue;
        }

        if (line == "") {
            out.push({
                number: i + 1,
                raw: raw,
                type: "newl",
                tag: "none",
                properties: properties
            });
            continue;
        }

        out.push({
            number: i + 1,
            raw: raw,
            type: "not-defined",
            tag: "none",
            properties: properties
        });
    }
    return out;
}

/**
 * tries to emulate the initial indentation
 * @param {Object} line xml element line
 * @returns emulated spaces number
 */
function getSpaceSize(line) {
    let spaces = line.match(/(\s+).+/);
    let spaceSize = 0;
    if (spaces) {
        spaces = spaces[1].replace('\t', '    ');
        spaceSize = parseInt(spaces.length / 4);
    }
    return spaceSize;
}

/**
 * sanitizes the text moving each tag on a new line and escapes special characters
 * @param {String} text 
 * @returns sanitized text
 */
function sanitizeInput(text) {
    text = text.replace(/\&\#\x\A\;/g, '\\n');
    text = text.replace(/>[^\n][\s]*?</g, ">\n<");
    text = text.replace(/></g, ">\n<");
    text = text.replace(/\&quot;/g, '\'');
    text = text.replace(/call-bsh/g, 'script');

    // multiline wrapped tags
    let match = false;
    while (match = text.match(/(<[\w].+[^>])((?:\n\s*?[\w].+[^>])*)(\n\s*?[^<][\w].+[\/]?[>])/)) {
        text = text.substr(0, match.index) + match[1] + match[2].replace(/\s+/g, ' ') + match[3].replace(/\s+/g, ' ') + text.substr(match.index + match[0].length);
    }

    // escaping quotation marks in groovy snippets
    while (match = text.match(/\=\"(?:\$\{(.+?)\})\"/)) {
        text = text.substr(0, match.index) + '="' + match[1].replace(/\"/g, '\'') + '"' + text.substr(match.index + match[0].length);
    }

    return text;
}