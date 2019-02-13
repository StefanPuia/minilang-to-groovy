/*jslint node: true, esversion: 6 */
'use strict';

let variables = [];
let warnings = [];
let errors = [];
let dependencies = [];

module.exports = {
    addDependency     : addDependency,
    addError          : addError,
    addVariables      : addVariables,
    addWarning        : addWarning,
    dependencies      : dependencies,
    errors            : errors,
    getEntityOperator : getEntityOperator,
    getErrType        : getErrType,
    getOperator       : getOperator,
    getRoundingMode   : getRoundingMode,
    getWarnType       : getWarnType,
    isChildOf         : isChildOf,
    isParentOf        : isParentOf,
    isSiblingOf       : isSiblingOf,
    methodExists      : methodExists,
    sortVars          : sortVars,
    spaces            : spaces,
    variables         : variables,
    warnings          : warnings,
};

/**
 * creates the indentation
 * @param {int} s spaces
 * @returns {String} spacing
 */
function spaces (s = 0) {
    s = s < 0 || isNaN(parseInt(s)) ? 0 : s;
    return " ".repeat(4).repeat(s);
}

/**
 * checks if the children have "tag" as a parent
 * can use 
 * @param {Array} children 
 * @param {String | Array} tag tag name
 * @returns {Boolean}
 */
function isParentOf (children = [], tags = "root") {
    if(typeof tags == 'string') {
        tags = [tags];
    }
    for(let tag of tags) {
        for(let child of children) {
            if((child.this && child.this.tag == tag) || 
                    (tag.indexOf('%') > -1 && child.this.tag.indexOf(tag.replace(/\%/g, '')) > -1)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * checks if an element has a sibling by name
 * @param {Object} parent element parent
 * @param {String | Array} tags tag or tags
 * @param {Object} obj this element
 * @returns {Boolean}
 */
function isSiblingOf (parent, tags = "root", obj = {}) {
    if(!parent || !parent.children) return -1;
    let siblings = parent.children;
    if (typeof tags == 'string') {
        tags = [tags];
    }
    for (let i = 0; i < siblings.length; i++) {
        if (siblings[i].this && tags.indexOf(siblings[i].this.tag) > -1 && siblings[i] !== obj) {
            return true;
        }
    }
    return false;
}

/**
 * checks if an element has a parent by name
 * @param {Object} parent parent element
 * @param {String | Array} tags
 * @returns {Boolean}
 */
function isChildOf (parent = {}, tags = "root") {
    if (typeof tags == 'string') {
        tags = [tags];
    }
    if (parent.this && parent.this && parent.this) {
        for(let t of tags) {
            if(t == parent.this.tag) {
                return true;
            }
            if(t.indexOf('%') > -1 && parent.this.tag.indexOf(t.replace(/\%/g, '')) > -1) {
                return true;
            }
        }
    }
    return false;
}

/**
 * checks if a minilang method is defined in the document
 * @param {String} methodName 
 * @param {Object} tree xml element tree
 * @returns {Boolean}
 */
function methodExists (methodName, tree) {
    let methods = [];
    let aux = Object.assign({}, tree);
    while (aux.parent) {
        if (aux.this.tag == "simple-methods") {
            methods = aux.children;
            break;
        }
        aux = aux.parent;
    }
    for(let method of methods) {
        if (method.this && method.this.tag == "simple-method" && method.this.properties && 
                method.this.properties['method-name'] == methodName) {
            return true;
        }
    }
    return false;
}

/**
 * adds a variable to the memory
 * to be used for undeclared variables warning
 * strips properties off of maps and only adds the map name
 * @param {String} variable variable name
 * @param {int} lineNumber line number
 * @param {String} type variable type
 */
function addVariables (variable, lineNumber, type) {
    variable = variable.trim().split(".")[0];
    for(let i = 0; i < variables.length; i++) {
        if (variables[i].name == variable) {
            return;
        }
    }
    variables.push({
        name: variable,
        number: lineNumber,
        type: type
    });
}

/**
 * adds a dependency to the memory
 * @param {String} d dependency name
 */
function addDependency (d) {
    if(dependencies.indexOf(d) == -1) {
        dependencies.push(d);
    }
}

/**
 * adds a warning to the memory
 * @param {String} t type
 * @param {String} w warning message
 */
function addWarning (t, w) {
    warnings.push({
        type: t,
        message: w
    });
}

/**
 * adds an error to the memory
 * @param {String} t type
 * @param {String} e error message
 */
function addError (t, e) {
    errors.push({
        type: t,
        message: e
    });
}

/**
 * converts operators
 * @param {String} operator minilang operator
 * @param {String} value optional value for complex operators
 * @returns {String}
 */
function getOperator (operator, value = "") {
    switch (operator) {
        case "equals": return ` == ${value}`;
        case "not-equals": return ` != ${value}`;
        case "greater": return ` > ${value}`;
        case "greater-equals": return ` >= ${value}`;
        case "less": return ` < ${value}`;
        case "less-equals": return ` <= ${value}`;

        case "add": return ` + ${value}`;
        case "multiply": return ` * ${value}`;
        case "divide": return ` / ${value}`;
        case "subtract": return ` - ${value}`;
        
        case "negative": return ` -${value}`;
        case "get": return ` `;
        case "contains": return `.contains(${value})`;
        default: return false;
    }
}

/**
 * creates entity condition builder operators
 * @param {String} operator minilang operator
 * @returns {String}
 */
function getEntityOperator (operator) {
    switch (operator) {
        case "equals": return "eq";
        case "not-equals": return "notEq";
        case "greater": return "gt";
        case "greater-equals": return "gtEq";
        case "less": return "lt";
        case "less-equals": return "ltEq";
        case "in": return "in";
        case "like": return "like";
        default: return false;
    }
}

/**
 * get the java rounding mode
 * @param {String} mode 
 * @returns {String}
 */
function getRoundingMode (mode = "") {
    switch (mode.trim().toLowerCase()) {
        case "halfeven": return "HALF_EVEN";
        case "halfup": return "HALF_UP";
        default: return false;
    }
}

/**
 * get the warning type
 * @param {String} t warning type
 */
function getWarnType(t) {
	switch(t) {
		case 'warn': return "WARNING";
		case 'notdef': return "NOT DEFINED";
		case 'suggest': return "SUGGESTION";
		case 'compat': return "NOT COMPATIBLE";
		case 'unknown': return "UNKNOWN";
	}
	return t;
}

/**
 * get the error type
 * @param {String} e error type
 */
function getErrType(t) {
	switch(t) {
		case 'parse': return "PARSE";
	}
	return t;
}

/**
 * sorts variables by name
 * @param {Object} a 
 * @param {Object} b 
 */
function sortVars(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
}