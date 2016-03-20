var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = require('../../jquery')(window);

var f = $("<fieldset>");
