/*jslint node: true, esversion: 6 */
'use strict';

module.exports = {
    compat       : true,  // compatibility
    displayLines : false, // show lines after each converted statement
    notdef       : true,  // show not defined parser errors
    parseonerror : true,  // show the line as a comment if there was a parse error
    suggest      : false, // show suggestions
    unknown      : true,  // show unknown warnings
    vars         : false, // show undeclared variables
    warn         : true,  // show warnings

    // custom ofbiz packages
    customDependencies: {
        "EntityAggregateQuery"   : "com.stannah.base.entity.EntityAggregateQuery",
        "EntityConditionBuilder" : "com.stannah.base.entity.condition.EntityConditionBuilder",
        "SystemPropertyUtils"    : "com.stannah.base.utils.SystemPropertyUtils",
    }
};