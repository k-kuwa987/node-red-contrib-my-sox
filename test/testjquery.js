var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = require('jquery')(window);
var Deferred = require( "JQDeferred" );

$.Deferred = Deferred;

var df = $.Deferred;
var data = '<body><shit a="b"></shit></body>';
var a = $(data).find('shit');
