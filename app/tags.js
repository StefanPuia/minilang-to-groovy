/*jslint node: true, esversion: 6 */
'use strict';

const util = require('./util');
const config = require('./config');
const resolve = require('./converter').resolve;
const spaces = util.spaces;
const isParentOf = util.isParentOf;
const isChildOf = util.isChildOf;
const isSiblingOf = util.isSiblingOf;
const methodExists = util.methodExists;
const addWarning = util.addWarning;
const addVariables = util.addVariables;
const addDependency = util.addDependency;
const getOperator = util.getOperator;
const getEntityOperator = util.getEntityOperator;
const getRoundingMode = util.getRoundingMode;

module.exports.root = {
    "converter": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        let text = `${resolvedChildren.join('')}`;
        if(!isParentOf(tree.children, ['simple-method', 'simple-methods'])) {
            text = `def _ERROR_ = null\n` + text;
        }
        return text;
    }
};

module.exports.newl = {
    "none": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        return ` //..//`;
    },
};

module.exports['not-defined'] = {
    "none": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        return `\n${spaces(s)}// ${line.raw}`;
    },
};

module.exports.script = {
    "script": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if(line.raw.match(/<!\[CDATA/) || line.raw.match(/]]>/)) {
            return '';
        }
        return `\n${spaces(s + line.spaces)}${line.raw}`;
    },
};

module.exports.selfclose = {
    "alt-permission": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['permission', 'action']);
        let p = line.properties;
        if (!p.permission) {
            return {error: `Missing permission.`};
        }
        addDependency('org.ofbiz.security.OFBizSecurity');
        if (p.action) {
            return `OFBizSecurity.hasEntityPermission("${p.action}", "${p.permission}", session)`;
        }
        return `OFBizSecurity.hasPermission("${p.permission}", session)`;
    },

    "calcop": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['operator', 'field']);
        let p = line.properties;
        if (!p.field || !p.operator) {
            return {error: `Missing field or operator.`};
        }
        let operator = getOperator(p.operator);
        if (!operator) {
            addWarning('notdef', `Operator "${p.operator}" not defined. Line ${line.number}`);
        }
        return `${p.field}${operator}`;
    },

    "call-class-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['method-name', 'class-name', 'ret-field']);
        let p = line.properties;
        if (!p['method-name'] || !p['class-name']) {
            return {
                error: `Missing method, class or return field.`
            };
        }
        let text = `${p['class-name']}.${p['method-name']}()`;
        if(p['ret-field']) {
            addVariables(p['ret-field']);
            text = `${p['ret-field']} = ${text}`;
        }
        return `\n${spaces(s)}${text}`;
    },

    "call-object-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if(!p['obj-field'] || !p['method-name']) {
            return {error: `Missing field or method name.`};
        }
        let text = `${p['obj-field']}.${p['method-name']}()`;
        if(p['ret-field']) {
            addVariables(p['ret-field']);
            text = `${p['ret-field']} = ${text}`;
        }
        return text;
    },

    "call-service": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['service-name'] || !p['in-map-name']) {
            return { error: `Missing service or map name.` };
        }
        return `\n${spaces(s)}runService("${p['service-name']}", ${p['in-map-name']})`;
    },

    "call-service-asynch": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['service-name'] || !p['in-map-name']) {
            return { error: `Missing service or map name.` };
        }
        return `dispatcher.runAsync("${p['service-name']}", ${p['in-map-name']})`;
    },

    "call-simple-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['method-name']) {
            return {
                error: `Missing method-name.`
            };
        }
        if(p['xml-resource']) {
            addDependency('org.ofbiz.base.util.ScriptUtil');
            return `\n${spaces(s)}ScriptUtil.executeScript("${p['xml-resource']}", ${p['method-name']}, context)`;
        }
        if (!methodExists(p['method-name'], tree)) {
            addWarning('warn', `Undeclared local method "${p['method-name']}" was called at line ${line.number}.`);
        }
        return `\n${spaces(s)}${p['method-name']}()`;
    },

    "check-errors": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['error-list-name']);
        return `\n${spaces(s)}if(_ERROR_) {` +
            `\n${spaces(s + 1)}return _ERROR_` +
            `\n${spaces(s)}}`;
    },

    "clear-field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        addVariables(p.field, line.number);
        return `\n${spaces(s)}${p.field} = null`;
    },

    "clone-value": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['new-value-field'] || !p['value-field']) {
            return {error: `Missing field or target field name.`};
        }
        return `\n${spaces(s)}${p['new-value-field']} = ${p['value-field']}.clone()`;
    },

    "comment": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if(isChildOf(parent, ['condition', 'entity-and', 'calcop'])) {
            return ` /*${line.comment}*/ `;
        }
        return `\n${spaces(s)}//${line.comment}`;
    },

    "condition-expr": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['field-name']) {
            return { error: `Missing field name.` };
        }
        let operator = "eq";
        if (p.operator) {
            if (!getEntityOperator(p.operator)) {
                addWarning('notdef', `Entity operator "${p.operator}" not defined.`);
            }
            operator = getEntityOperator(p.operator);
        }
        let value = `${p.value ? `"${p.value}"` : p['from-field']}`;
        return `.${operator}("${p['field-name']}", ${value})`;
    },

    "create-value": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p['value-field']) {
            return { error: `Missing value-field.` };
        }
        return `\n${spaces(s)}${p['value-field']}.create()`;
    },

    "default-message": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        addWarning('unknown', `Conversion not known for "default-message" at line ${line.number}`);
        return '';
    },

    "entity-one": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['entity-name'] || !p['value-field']) {
            return {
                error: `Missing entity or field name.`
            };
        }
        addVariables(p['value-field']);
        addDependency('org.ofbiz.entity.util.EntityQuery');
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        return `\n${spaces(s)}${p['value-field']} = EntityQuery.use(delegator)` +
            `\n${spaces(s+2)}.from("${p['entity-name']}")` +
            `\n${spaces(s+2)}.where(${resolvedChildren.join(', ')})` +
            `\n${spaces(s+2)}.queryFirst()`;
    },

    "fail-property": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['resource', 'property']);
        let p = line.properties;
        if(!p.resource || !p.property) {
            return {error: `Missing resource or property.`};
        }
        return `${p.resource}.${p.property}`;
    },

    "fail-message": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['message']);
        let p = line.properties;
        if(!p.message) {
            return {error: `Missing message.`};
        }
        return `"${p.message}"`;
    },

    "field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'type']);
        let p = line.properties;
        if (!p.field) {
            return {
                error: `Missing field.`
            };
        }
        // let type = p.type ? `${p.type} ` : '';
        return `${p.field}`;
    },

    "field-map": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if(!p['field-name'] || (!p.value && !p['from-field'])) {
            return {error: `Missing field name or value.`};
        }
        let value = `${p.value ? `"${p.value}"` : p['from-field']}`;
        return `"${p['field-name']}", ${value}`;
    },

    "field-to-list": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.list || !p.field) {
            return {
                error: `Missing field or list name.`
            };
        }
        addVariables(p.list, line.number);
        return `\n${spaces(s)}${p.list}.add(${p.field})`;
    },

    "field-to-request": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field || !p['request-name']) {
            return {error: `Missing field or request name.`};
        }
        return `\n${spaces(s)}request.setAttribute("${p['request-name']}", ${p.field})`;
    },

    "field-to-result": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        let result = p.field;
        if(p['result-name']) {
            result = p['result-name'];
        }
        return `\n${spaces(s)}request.setAttribute("${result}", ${p.field})`;
    },

    "filter-list-by-date": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if(!p.list) {
            return {error: `Missing list name.`};
        }
        addWarning('warn', `filterByDate was added after query. It should be placed before the queryFirst/queryList. Line ${line.number}`);
        return `\n${spaces(s+2)}.filterByDate()`;
    },

    "find-by-primary-key": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['entity-name'] || !p['value-field'] || !p.map) {
            return {
                error: `Missing entity, map or field name.`
            };
        }
        addVariables(p['value-field']);
        addDependency('org.ofbiz.entity.util.EntityQuery');
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        return `\n${spaces(s)}${p['value-field']} = EntityQuery.use(delegator)` +
            `\n${spaces(s+2)}.from("${p['entity-name']}")` +
            `\n${spaces(s+2)}.where(${p.map})` +
            `\n${spaces(s+2)}.queryFirst()`;
    },

    "find-by-and": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['entity-name'] || !p.list || !p.map) {
            return {
                error: `Missing entity, map or list name.`
            };
        }
        addVariables(p.list);
        addDependency('org.ofbiz.entity.util.EntityQuery');
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        return `\n${spaces(s)}${p.list} = EntityQuery.use(delegator)` +
            `\n${spaces(s+2)}.from("${p['entity-name']}")` +
            `\n${spaces(s+2)}.where(${p.map})` +
            `\n${spaces(s+2)}.queryList()`;
    },

    "first-from-list": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.entry || !p.list) {
            return {
                error: `Missing entity or list name.`
            };
        }
        addVariables(p.entry, line.number);
        return `\n${spaces(s)}${p.entry} = ${p.list}[0]`;
    },

    "get-related": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['value-field'] || !p.list || !p['relation-name']) {
            return {
                error: `Missing field, relation or target list name.`
            };
        }
        addVariables(p.list);
        return `\n${spaces(s)}${p.list} = ${p['value-field']}.getRelated("${p['relation-name']}", null, null, false)`;
    },

    "get-related-one": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if(!p['value-field'] || !p['to-value-field'] || !p['relation-name']) {
            return {error: `Missing field, relation or target field name.`};
        }
        addVariables(p['to-value-field']);
        return `\n${spaces(s)}${p['to-value-field']} = ${p['value-field']}.getRelatedOne("${p['relation-name']}", false)`;
    },

    "if-compare": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 4);
        if (!isChildOf(parent, ["or", "and", "not", "condition"])) {
            return {
                error: `Condition needs to be inside a conditional block.`
            };
        }
        let p = line.properties;
        if (!p.field || !p.operator || (!p.value && !p['from-field'])) {
            return {
                error: `Missing field name, operator or value.`
            };
        }
        let value = `${p.value ? `"${p.value}"` : p['from-field']}`;
        if (!getOperator(p.operator)) {
            addWarning('notdef', `Conditional operator "${p.operator}" not defined.`);
        }
        return `${p.field}${getOperator(p.operator, value)}`;
    },

    "if-compare-field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['type', 'field', 'operator', 'to-field']);
        if (!isChildOf(parent, ["or", "and", "not", "condition"])) {
            return {
                error: `Condition needs to be inside a conditional block.`
            };
        }
        let p = line.properties;
        if (!p.field || !p.operator || !p['to-field']) {
            return {
                error: `Missing field name, operator or target field.`
            };
        }
        if (!getOperator(p.operator)) {
            addWarning('notdef', `Conditional operator "${p.operator}" not defined.`);
        }
        return `${p.field}${getOperator(p.operator, p['to-field'])}`;
    },

    "if-empty": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field']);
        let p = line.properties;
        if (!isChildOf(parent, ["or", "and", "not", "condition"])) {
            return { error: `Condition needs to be inside a conditional block.` };
        }
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        return `!${p.field}`;
    },

    "if-not-empty": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 'field');
        let p = line.properties;
        if (!isChildOf(parent, ["or", "and", "not", "condition"])) {
            return { error: `Condition needs to be inside a conditional block.` };
        }
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        return `${p.field}`;
    },

    "log": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['message', 'level']);
        let p = line.properties;
        if (!p.message) {
            return { error: `Missing message.` };
        }
        addDependency('org.ofbiz.base.util.Debug');
        return `\n${spaces(s)}Debug.${p.level.toLowerCase()}("${p.message}")`;
    },

    "make-value": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['value-field'] || !p['entity-name']) {
            return { error: `Missing field or entity name.` };
        }
        addVariables(p['value-field'], line.number);
        return `\n${spaces(s)}${p['value-field']} = delegator.makeValue("${p['entity-name']}")`;
    },

    "now-timestamp": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        addVariables(p.field, line.number);
        addDependency('java.sql.Timestamp');
        addDependency('org.ofbiz.base.util.UtilDateTime');
        return `\n${spaces(s)}${p.field} = UtilDateTime.nowTimestamp()`;
    },

    "number": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.value) {
            return { error: `Missing value.` };
        }
        return `${p.value}`;
    },

    "order-by": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p['field-name']) {
            return { error: `Missing field-name.` };
        }
        return `\n${spaces(s+1)}.orderBy("${p['field-name']}")`;
    },

    "property-to-field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'resource', 'property', 'value', 'default', 'no-locale']);
        let p = line.properties;
        if(!p.field || !p.resource || !p.property) {
            return {error: `Missing field, resource or property. `};
        }
        if(p['no-locale']) {
            addWarning('unknown', `Property definition for "not-locale" of "property-to-field" tag not known at line ${line.number}.`);
        }
        addDependency(config.customDependencies.SystemPropertyUtils);
        let text = `\n${spaces(s)}${p.field} = SystemPropertyUtils.getString(delegator, "${p.resource}", "${p.property}"`;
        if(p.default) {
            text = `, "${p.default}"`;
        }
        text += `);`;
        return text;
    },

    "set-service-fields": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if(!p['service-name'] || !p['to-map'] || !p.map) {
            return {error: `Missing service or map names.`};
        }
        addVariables(p['to-map'], line.number);
        addDependency('org.ofbiz.service.ServiceUtil');
        return `\n${spaces(s)}${p['to-map']} = ServiceUtil.setServiceFields(dispatcher, "${p['service-name']}", ${p.map})`;
    },

    "remove-by-and": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.map || !p['entity-name']) {
            return {
                error: `Missing entity or list name.`
            };
        }
        return `\n${spaces(s)}delegator.removeByAnd("${p['entity-name']}", ${p.map})`;
    },

    "remove-list": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.list) {
            return { error: `Missing list.` };
        }
        return `\n${spaces(s)}for(${p.list}Item in ${p.list}) ${p.list}Item.remove()`;
    },

    "remove-related": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if(!p['relation-name'] || !p['value-field']) {
            return {error: `Missing field or relation name.`};
        }
        return `\n${spaces(s)}delegator.removeRelated("${p['relation-name']}", ${p['value-field']})`;
    },

    "remove-value": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p['value-field']) {
            return { error: `Missing value-field name.` };
        }
        return `\n${spaces(s)}${p['value-field']}.remove()`;
    },

    "result-to-field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'result-name']);
        if (!isChildOf(parent, "call-service")) {
            return { error: `Result field needs to be inside a call-service block.` };
        }
        let p = line.properties;
        if (!p['result-name']) {
            return { error: `Missing field name.` };
        }
        let results = [p['result-name']];
        if(p.field) {
            results.push(p.field);
        }
        return results;
    },

    "result-to-result": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p['result-name']) {
            return {
                error: `Missing field name.`
            };
        }
        return `\n${spaces(s)}request.setAttribute("${p['result-name']}", ${p['result-name']})`;
    },

    "return": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['response-code']);
        let p = line.properties;
        let respose = p['response-code'] ? p['response-code'] : "";
        return `\n${spaces(s)}return ${respose}`;
    },

    "script": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if(!p.location) {
            return {error: `Missing location.`};
        }
        let location = p.location;
        let method = '';
        if (p.location.indexOf('#') > -1) {
            location = p.location.substr(0, p.location.indexOf('#'));
            method = p.location.substr(p.location.indexOf('#') + 1);
        }
        addDependency('org.ofbiz.base.util.ScriptUtil');
        let text = `\n${spaces(s)}ScriptUtil.executeScript("${p.location}", ${p.method ? `"${p.method}"` : "null"}, context)`;
        return text;
    },

    "sequenced-id": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field || !p['sequence-name']) {
            return { error: `Missing field or sequence name.` };
        }
        return `\n${spaces(s)}${p.field} = delegator.getNextSeqId("${p['sequence-name']}")`;
    },

    "set": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'from-field', 'value', 'type', 'global', 'default-value', 'set-if-null', 'set-if-empty']);
        let p = line.properties;
        if (!p.field || (!p['from-field'] && typeof p.value == undefined && !p['default-value'])) {
            return { error: `Missing field name or resource.` };
        }

        let ifEmptyValue = p['set-if-empty'] ? p['set-if-empty'] : (p['set-if-null'] ? p['set-if-null'] : false);

        let value = `null`;
        if (p['from-field'] || p.value) {
            value = `${p.value ? `"${p.value}"` : p['from-field']}`;
            value = p['set-if-null'] ? `${value} ? ${value} : "${p['set-if-null']}"` : value;
        }
        else {
            value = p['default-value'] ? `"${p['default-value']}"` : value;
        }
        
        let text = `${p.field} = ${value}`;
        if (p.global && p.global.toLowerCase() == 'true') {
            text = `context.${p.field} = ` + text;
            addWarning(`Property "global" not defined in the apache documentation. It is assumend the variable should be added to the context. Line ${line.number}`);
        }
        if (parent.this.type == 'root') text = '\n' + text;
        addVariables(p.field, line.number, p.type);
        return `\n${spaces(s)}${text}`;
    },

    "set-calendar": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'from-field', 'value', 'days', 'months', 'years']);
        let p = line.properties;
        if(!p.field || (!p['from-field'] && !p.value)) {
            return {error: `Missing field or value.`};
        }
        let value = `${p.value ? `"${p.value}"` : p['from-field']}`;
        addVariables(p.field);
        addDependency('java.util.Calendar');
        let calName = `${p.field}Cal`;
        let text = `\n${spaces(s)}${calName} = Calendar.getInstance()` +
                    `\n${spaces(s)}${calName}.setTime(${value})`;
        
        if (p.days) {
            text += `\n${spaces(s)}${calName}.set(GregorianCalendar.DATE, ${p.days})`;
        }
        if (p.months) {
            text += `\n${spaces(s)}${calName}.set(GregorianCalendar.MONTH, ${p.months})`;
        }
        if (p.years) {
            text += `\n${spaces(s)}${calName}.set(GregorianCalendar.YEAR, ${p.years})`;
        }
        text += `\n${spaces(s)}${p.field} = ${calName}.getTime()`;
        return text;
    },

    "set-pk-fields": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['value-field'] || !p.map) {
            return { error: `Missing value or map.` };
        }
        addVariables(p['value-field']);
        return `\n${spaces(s)}${p['value-field']}.setPKFields(${p.map})`;
    },

    "set-nonpk-fields": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['value-field'] || !p.map) {
            return {
                error: `Missing value or map.`
            };
        }
        addVariables(p['value-field']);
        return `\n${spaces(s)}${p['value-field']}.setNonPKFields(${p.map})`;
    },

    "store-value": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if(!p['value-field']) {
            return {error: `Missing value-field name.`};
        }
        return `\n${spaces(s)}${p['value-field']}.store()`;
    },

    "store-list": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.list) {
            return {
                error: `Missing list name.`
            };
        }
        return `\n${spaces(s)}${p.list}.store()`;
    },

    "string": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if(!p.value) {
            return {error: `Missing value.`};
        }
        return `"${p.value}"`;
    },

    "to-string": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if(!p.field) {
            return {error: `Missing field.`};
        }
        addVariables(p.field);
        return `${p.field} = ${p.field}.toString()`;
    },

    "transaction-begin": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        addWarning('unknown', `Groovy files are transaction-safe by default. Line ${line.number}`);
        return ``;
    },

    "transaction-commit": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        addWarning('unknown', `Groovy files are transaction-safe by default. Line ${line.number}`);
        return ``;
    },

    "use-iterator": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        addWarning('suggest', `Entity Query was using a list iterator. Consider swapping .queryList for .queryIterator(). Line ${line.number}`);
        return '';
    }
};

module.exports.open = {
    "and": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if (!isChildOf(parent, ["if%", "and", "or", "condition"])) {
            return {error: `Condition blocks need to be inside a conditional block.`};
        }
        if (isSiblingOf(parent, ["if%"], tree.this)) {
            return `(${resolvedChildren.join(' && ')})`;
        }
        return resolvedChildren.join(' && ');
    },

    "add-error": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        return `_ERROR_ = ${resolvedChildren.join('')}`;
    },

    "calcop": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'operator']);
        let p = line.properties;
        if (!p.operator) {
            return {
                error: `Missing field or operator.`
            };
        }
        if(isParentOf(tree.children, 'comment')) {
            addWarning('warn', `Comments inside a "calcop" tag will break the output. Line ${line.number}`);
        }
        let operator = getOperator(p.operator);
        if (!operator) {
            addWarning('notdef', `Operator "${p.operator}" not defined. Line ${line.number}`);
        }
        if(p.field) {
            return `${p.field} ${operator} ${resolvedChildren.join('')}`;
        }
        return `(${resolvedChildren.join(` ${operator} `)})`;
    },

    "calculate": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field) {
            return {
                error: `Missing field.`
            };
        }
        let type = p.type ? `${p.type} ` : '';
        let text = `\n${spaces(s)}${type}${p.field} = ${resolvedChildren.join(' ')}`;
        let scales = [];
        if(p['decimal-scale']) {
            scales.push(p['decimal-scale']);
        }
        if(p['rounding-mode']) {
            scales.push(`RoundingMode.${getRoundingMode(p['rounding-mode'])}`);
        }
        if(scales.length) {
            text += `.setScale(${scales.join(', ')})`;
        }
        return text;
    },

    "call-service": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['service-name']) {
            return { error: `Missing service name.` };
        }
        let text = `\n${spaces(s)}`;
        if (resolvedChildren.length > 1) {
            addVariables(resolvedChildren[1], line.number);
            text += resolvedChildren[1] + ' = ';
        }
        if(resolvedChildren.length > 0) {
            text += `${resolvedChildren[0]} = `;
        }
        text += `dispatcher.runSync("${p['service-name']}", ${p['in-map-name']})`;
        return text;
    },

    "call-class-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['method-name'] || !p['class-name'] || !p['ret-field']) {
            return { error: `Missing method, class or return field.` };
        }
        addVariables(p['ret-field']);
        return `\n${spaces(s)}${p['ret-field']} = ${p['class-name']}.${p['method-name']}(${resolvedChildren.join(', ')})`;
    },

    "check-permission": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if(!p.permission) {
            return {error: `Missing permission.`};
        }
        let failProperty = "";
        if (isParentOf(tree.children, 'fail-property')) {
            return {error: `Missing fail property.`};
        }
        let failPropertyIndex = tree.children.map(c => { return (c && c.this && c.this.tag) ? c.this.tag : ""; }).indexOf('fail-property');
        failProperty = resolve(tree.children[failPropertyIndex], 0);
        let permissions = tree.children.slice();
        let permissionStrings = [];
        if (p.action) {
            permissionStrings.push(`OFBizSecurity.hasEntityPermission("${p.action}", "${p.permission}", session)`);
        } else {
            permissionStrings.push(`OFBizSecurity.hasPermission("${p.permission}", session)`);
        }
        if(permissions.length > 1) {
            permissions.forEach((p) => {
                if(p.this.tag != 'fail-property') {
                    permissionStrings.push(resolve(p));
                }
            });
        }
        addDependency('org.ofbiz.security.OFBizSecurity');
        addWarning('unknown', `Check Permission must be followed by the <check-errors/> element for it to do anything meaningful.`);
        return `\n${spaces(s)}if (!${permissionStrings.join(' || !')}) {` +
                `\n${spaces(s+1)}_ERROR_ = ${failProperty}` +
                `\n${spaces(s)}}`;
    },

    "condition": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if (!isChildOf(parent, ["if", "else-if"])) {
            return { error: `Condition blocks need to be inside an "if" block.` };
        }
        if(isParentOf(tree.children, ["if%"])) {
            return `(${resolvedChildren.join(' && ')})`;
        }
        return `(${resolvedChildren.join('')})`;
    },

    "condition-list": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ["combine"]);
        let p = line.properties;
        p.combine = p.combine ? p.combine.toLowerCase() : 'and';
        if(isParentOf(tree.children, ["condition-list"]) || p.combine == 'or') {
            return `.${p.combine.toLowerCase()}()` +
                `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}` +
                `\n${spaces(s)}.end${p.combine.substr(0, 1).toUpperCase()}${p.combine.substr(1).toLowerCase()}()`;
        }
        return `${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
    },

    "else": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if(!isChildOf(parent, ['if%'])) {
            return {error: `"else" field can only be a child of conditional blocks.`};
        }
        if(isSiblingOf(parent, ['else', 'else-if'], tree)) {
            return {error: `"else" child must be unique inside a conditional block.`};
        }
        return `\n${spaces(s - 1)}}\n${spaces(s - 1)}else {` +
            `\n${spaces(s)}${resolvedChildren.join(`\n${spaces(s)}`)}` +
            `\n${spaces(s - 1)}}`;
    },

    "else-if": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        let text = `\n${spaces(s - 1)}}\n${spaces(s - 1)}else if ` +
            `${resolvedChildren.join(``)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "entity-and": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['entity-name'] || !p.list) {
            return { error: `Missing entity or list name.` };
        }
        addVariables(p.list, line.number);
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        addDependency('org.ofbiz.entity.util.EntityQuery');
        return `\n${spaces(s)}${p.list} = EntityQuery.use(delegator)` + 
                `\n${spaces(s+2)}.from("${p['entity-name']}")` + 
                `\n${spaces(s+2)}.where(${resolvedChildren.join(', ')})` +
                `${p['filter-by-date'] ? `\n${spaces(s + 2)}.filterByDate()` : ''}` +
                `\n${spaces(s+2)}.queryList()`;
    },

    "entity-condition": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p['entity-name'] || !p.list) {
            return { error: `Missing entity or list name.` };
        }
        addVariables(p.list, line.number);
        addDependency('org.ofbiz.entity.util.EntityQuery');
        addDependency(config.customDependencies.EntityConditionBuilder);
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        return `\n${spaces(s)}EntityConditionBuilder ${p.list}Conditions = EntityConditionBuilder.create()` +
            `\n${spaces(s + 2)}${resolvedChildren.join('')}` +
            `\n${spaces(s)}${p.list} = EntityQuery.use(delegator)` +
            `\n${spaces(s + 2)}.from("${p['entity-name']}")` +
            `\n${spaces(s + 2)}.where(${p.list}Conditions.build())` +
            `${p['filter-by-date'] ? `\n${spaces(s + 2)}.filterByDate()` : ''}` +
            `\n${spaces(s + 2)}.queryList()`;
    },

    "entity-count": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p['entity-name'] || !p['count-field']) {
            return {
                error: `Missing entity or field name.`
            };
        }
        addVariables(p['count-field'], line.number);
        addDependency(config.customDependencies.EntityAggregateQuery);
        addDependency(config.customDependencies.EntityConditionBuilder);
        addWarning('suggest', `Entity Aggregate Query created without any group fields. This may cause errors. Line ${line.number}`);
        return `\n${spaces(s)}EntityConditionBuilder ${p['count-field']}Conditions = EntityConditionBuilder.create()` +
            `\n${spaces(s + 1)}${resolvedChildren.join('')}` +
            `\n${spaces(s)}${p['count-field']} = EntityAggregateQuery.use(delegator)` +
            `\n${spaces(s + 2)}.from("${p['entity-name']}")` +
            `\n${spaces(s + 2)}.groupBy("fieldName")` +
            `\n${spaces(s + 2)}.where(${p['count-field']}Conditions.build())` +
            `\n${spaces(s + 2)}.count("fieldName").as("countField")` +
            `\n${spaces(s + 2)}.queryFirst()` +
            `\n${spaces(s + 2)}.countField`;
    },

    "entity-one": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['entity-name', 'value-field', 'auto-field-map']);
        // not interested in auto-field-map
        let p = line.properties;
        if (!p['entity-name'] || !p['value-field']) {
            return { error: `Missing entity or field name.` };
        }
        addDependency('org.ofbiz.entity.util.EntityQuery');
        addWarning('suggest', `Entity Query created without any select fields. Consider adding them to decrease query time. Line ${line.number}`);
        return `\n${spaces(s)}${p['value-field']} = EntityQuery.use(delegator)` +
                `\n${spaces(s+2)}.from("${p['entity-name']}")` +
                `\n${spaces(s+2)}.where(${resolvedChildren.join(', ')})` +
                `\n${spaces(s+2)}.queryFirst()`;
    },

    "if": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        let text = `\n${spaces(s)}if ${resolvedChildren.join('')}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-compare": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 4);
        let p = line.properties;
        if (!p.field || !p.operator || (!p.value && !p['from-field'])) {
            return { error: `Missing field name, operator or value.` };
        }
        if (!getOperator(p.operator)) {
            addWarning('notdef', `Conditional operator "${p.operator}" not defined.`);
        }
        let value = `${p.value ? `"${p.value}"` : p['from-field']}`;
        let text = `\n${spaces(s)}if (${p.field}${getOperator(p.operator, value)}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-compare-field": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['field', 'operator', 'to-field', 'type']);
        let p = line.properties;
        if (!p.field || !p.operator || !p['to-field']) {
            return { error: `Missing field name, operator or target field.` };
        }
        if (!getOperator(p.operator)) {
            addWarning('notdef', `Conditional operator "${p.operator}" not defined.`);
        }
        let text = `\n${spaces(s)}if (${p.field}${getOperator(p.operator, p['to-field'])}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-empty": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        let text = `\n${spaces(s)}if (!${p.field}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-instance-of": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field || !p.class) {
            return {
                error: `Missing field or class name.`
            };
        }
        let text = `\n${spaces(s)}if (${p.field} instanceof ${p.class}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-not-empty": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.field) {
            return { error: `Missing field name.` };
        }
        let text = `\n${spaces(s)}if (${p.field}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "if-validate-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.field || !p.method) {
            return { error: `Missing field or method name.` };
        }
        let packageName = `org.ofbiz.base.util.UtilValidate`;
        if(p.class) {
            packageName = p.class;
        }
        addDependency(packageName);
        let className = packageName.split('.').pop();
        let text = `\n${spaces(s)}if (${className}.${p.method}(${p.field})) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join(`\n${spaces(s + 1)}`)}`;
        if (!isParentOf(tree.children, ["else", "else-if"])) text += `\n${spaces(s)}}`;
        return text;
    },

    "iterate": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        let p = line.properties;
        if (!p.entry || !p.list) {
            return { error: `Missing entry or list name.` };
        }
        return `\n${spaces(s)}for(${p.entry} in ${p.list}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join('')}` +
            `\n${spaces(s)}}`;
    },

    "iterate-map": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 3);
        let p = line.properties;
        if (!p.value || !p.map || !p.key) {
            return {
                error: `Missing map, key or field name.`
            };
        }
        return `\n${spaces(s)}for(${p.value} in ${p.map}.${p.key}) {` +
            `\n${spaces(s + 1)}${resolvedChildren.join('')}` +
            `\n${spaces(s)}}`;
    },

    "log": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 1);
        let p = line.properties;
        if (!p.message) {
            return {
                error: `Missing message.`
            };
        }
        addDependency('org.ofbiz.base.util.Debug');
        return `\n${spaces(s)}Debug.log("${p.message}")`;
    },

    "not": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if (!isChildOf(parent, ["if%", "and", "or", "condition"])) {
            return {error: `Condition blocks need to be inside an "if" block.`};
        }
        return `!(${resolvedChildren.join('')})`;
    },

    "or": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if (!isChildOf(parent, ["if%", "and", "or", "condition"])) {
            return {error: `Condition blocks need to be inside an "if" block.`};
        }
        if(isSiblingOf(parent, ["if%"], tree.this)) {
            return `(${resolvedChildren.join(' || ')})`;
        }
        return resolvedChildren.join(' || ');
    },

    "script": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        return resolvedChildren.join('');
    },

    "simple-method": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 2);
        return `\n${spaces(s)}// ${line.properties['short-description']}` + 
                `\n${spaces(s)}def ${line.properties['method-name']}() {` + 
                `\n${spaces(s+1)}def _ERROR_ = null` +
                `\n${spaces(s+1)}${resolvedChildren.join(`\n${spaces(s+1)}`)}\n${spaces(s)}}`;
    },

    "simple-methods": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['xmlns:xsi', 'xsi:noNamespaceSchemaLocation']);
        let p = line.properties;
        return `\n${spaces(s)}// Simple methods list` + 
                `\n${resolvedChildren.join('')}`;
    },

    "service": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, ['service-name', 'result-map']);
        let p = line.properties;
        if (!p['service-name'] || !p['result-map']) {
            return { error: `Missing servcie or map name.` };
        }
        addDependency('org.ofbiz.base.util.UtilMisc');
        return `\n${spaces(s)}${p['result-map']} = runService("${p['service-name']}", UtilMisc.toMap(${resolvedChildren.join(', ')}))`;
    },

    "then": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        if (!isChildOf(parent, "if")) {
            return { error: `Then blocks need to be inside an "if" block.` };
        }
        return ` {\n${spaces(s)}${resolvedChildren.join(`\n${spaces(s)}`)}`;
    },

    "while": (line, parent, resolvedChildren, s, tree) => {
        parameterUsage(line, 0);
        let text = `\n${spaces(s)}while ${resolvedChildren.join('')}`;
        // if (!isParentOf(tree.children, ["else", "else-if"])) 
        text += `\n${spaces(s)}}`;
        return text;
    },
};

/**
 * creates parse warnings for not defined parameters
 * @param {Object} line xml element
 * @param {Array | int} pars number of parameters or actual names
 */
function parameterUsage(line, pars) {
    if(line && line.properties) {
        if(typeof pars == 'object' && pars.length) {
            let missing = [];
            Object.keys(line.properties).forEach((p) => {
                if(pars.indexOf(p) == -1) {
                    missing.push(p);
                }
            });
            if(missing.length) {
                addWarning('notdef', `Properties: "${missing.join('", "')}" have not been defined for ${line.type} tag "${line.tag}" on line ${line.number}`);
            }
        }
        else if (Object.keys(line.properties).length > pars) {
            addWarning('notdef', `${Object.keys(line.properties).length - pars} properties have not been defined for ${line.type} tag "${line.tag}" on line ${line.number}`);
        }
    }
}