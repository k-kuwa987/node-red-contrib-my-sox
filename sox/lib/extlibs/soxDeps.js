var events = require('events');
var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = require('jquery-lite')(window);

var strophe = require("node-strophe").Strophe;
var Strophe = strophe.Strophe;
var $iq = strophe.$iq;
// var Backbone = require("backbone");
var _ = require('underscore');