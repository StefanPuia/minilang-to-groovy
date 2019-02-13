/*jslint node: true, esversion: 6 */
'use strict';

const util = require('./util');
const tags = require('./tags');
const config = require('./config');
const parser = require('./parser');
const recursive = require('./recursive');
const options = require('./config');

const nonOutputOpen = ["add-error"];
const outputSelfclose = ["comment", "check-errors"];

const spaces = util.spaces;
const sortVars = util.sortVars;
const getWarnType = util.getWarnType;
const getErrType = util.getErrType;
const addWarning = util.addWarning;
const addError = util.addError;
const warnings = util.warnings;
const errors = util.errors;
const variables = util.variables;
const dependencies = util.dependencies;

const displayLines = config.displayLines;
const parseOnError = config.parseonerror;

let output = "";

module.exports = {
	convert: convert
};

/**
 * initiate conversion
 * @param {Object} tree 
 * @returns resolved groovy script
 */
function convertTree(tree) {
	output = "";
 	parseTree(tree, -1);
	return {
		converted: output + '\n\n'
	};
}

/**
 * depth parse tree
 * @param {Object} tree tree element
 * @param {int} s spaces
 * @returns resolved tree
 */
function parseTree(tree, s) {
	tree.resolvedChildren = [];
	if(tree.children) {
		tree.children.forEach((c) => {
			let children = parseTree(c, s + 1);
			if (typeof children == 'object' && children.length) {
				tree.resolvedChildren = tree.resolvedChildren.concat(tree.resolvedChildren, children);
			} else {
				tree.resolvedChildren.push(children);
			}
		});
	}
	let resolved = resolve(tree, s);
	return resolved + (displayLines ? ` /* ${tree.this.number} */ ` : '');
}

/**
 * use the tags to transform the lines into groovy
 * @param {Object} line element
 * @param {int} s spaces
 * @returns resolved line
 */
function resolve(line, s) {
	let resolved;
	if(line) {
		if(line.this && line.this.tag) {
			if (!tags[line.this.type] || typeof tags[line.this.type][line.this.tag] !== "function") {
				addWarning('notdef', `Parser not defined for "${line.this.type}" tag "${line.this.tag}" on line ${line.this.number}`);
				return "";
			}
			resolved = tags[line.this.type][line.this.tag](line.this, line.parent, line.resolvedChildren, s, line);
			if(resolved.error) {
				addError('parse', `"${line.this.tag}" at line ${line.this.number}. ${resolved.error}\n${line.this.raw}`);
				if (parseOnError) {
					resolved =  `\n${spaces(s)}// ${line.this.raw}`;
				}
				else {
					resolved = "";
				}
			}
			switch(line.this.type) {
				case 'selfclose':
					if (outputSelfclose.indexOf(line.this.tag) > -1 && !line.parent) {
						output += resolved;
					}
					return resolved;
				
				case 'open':
					if(nonOutputOpen.indexOf(line.this.tag) == -1 && !line.parent) {
						output += resolved;
					}
					return resolved;
				
				case 'root':
					output += resolved;
					return resolved;

				case 'newl':
					return resolved;

				case 'script':
					return resolved;

				case 'not-defined':
					return resolved;
			}
		}
		return "";
	}
}

/**
 * initiates the conversion
 * sanitizes the input and converts the lines into groovy
 * @param {String} text input text
 * @returns {Promise}
 */
function convert(text) {
	return new Promise((resolve, reject) => {
		let hidden = {
			warnings: 0
		};
		warnings.splice(0, warnings.length);
		errors.splice(0, errors.length);
		variables.splice(0, variables.length);
		dependencies.splice(0, dependencies.length);

		let list = parser.parseXML(text);
		let tree = {
			parent: null,
			this: {
				tag: 'converter',
				type: 'root',
				number: 0,
				comment: 'Beginning of code'
			},
			children: []
		};
		let current = tree;
		recursive.getStack(current, list, 0);


		let converted = convertTree(tree).converted;
		let out = converted + '\n';
		out = out.replace(/\n\s+\n/g, '\n');
		out = out.replace(/\s+\/\/\.\.\/\//g, '\n');

		let depString = "";
		let lastDep = dependencies.sort()[0] ? dependencies.sort()[0].split('.')[0] : "";
		dependencies.sort().forEach((d) => {
			if (d.split('.')[0] !== lastDep) {
				depString += '\n';
				lastDep = d.split('.')[0];
			}
			depString += `import ${d}\n`;
		});

		if (depString.length) {
			out = depString + '\n' + out;
		}
		variables.sort(sortVars).forEach((v, k) => {
			if (options.vars == true) {
				out = out + `\n// VAR ASSIGN: "${v.name}" not declared. First seen ${v.number}`;
				if (v.type) {
					out += ` with type "${v.type}"`;
				}
			} else {
				hidden.vars = true;
			}
		});
		warnings.forEach((w, k) => {
			if (options[w.type] == true) {
				out = out + `\n// ${getWarnType(w.type)}: ${w.message}`;
			} else {
				hidden.warnings++;
			}
		});
		errors.forEach((e, k) => {
			out = out + `\n// ${getErrType(e.type)} ERROR: ${e.message}`;
		});
		resolve(out);
	});
}