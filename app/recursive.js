/*jslint node: true, esversion: 6 */
'use strict';

module.exports = {
    getStack : getStack,
    drawTree : drawTree
};

/**
 * converts the xml element list into a tree
 * @param {Object} current current tree
 * @param {Array} list xml elements
 * @param {int} key position
 */
function getStack(current, list, key) {
    if(key >= list.length || !current) {
        return current;
    }

    let obj = list[key];
    if(current && typeof current.children == 'undefined') {
        current.children = [];
    }

    if(obj.type == "open") {
        let n = {
            this: obj,
            parent: current,
            children: []
        };
        current.children.push(n);
        current = n;
    }

    if (obj.type == "selfclose" || obj.type == "newl" || obj.type == "not-defined" || obj.type == "script") {
        current.children.push({
            this: obj,
            parent: current
        });
    }

    if(obj.type == "close") {
        if(current.this.tag.trim() != obj.tag.trim() && current.this.number !== 0) {
            console.log(`Mismatch closing tag. ${current.this.tag}:${current.this.number} -> ${obj.tag}:${obj.number}`);
        }
        current = current.parent;
    }

    getStack(current, list, key + 1);
}

/**
 * draws a tree from the input object
 * @param {String} out output string
 * @param {Object} tree xml tree
 * @param {int} s spacing
 */
function drawTree(out, tree, s) {
    if(tree && tree.this && tree.this.tag) {
        out.push(" ".repeat(s) + tree.this.tag);
    }
    else {
        out.push(" ".repeat(s) + tree);
    }
    if(tree.children) {
        tree.children.forEach((c) => {
            drawTree(out, c, s + 4);
        });
    }
    else {
        return;
    }
}