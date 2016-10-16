var events = require('events');
var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = function (data){
    return new MyJquery(data);  
};

var MyJquery = function(data){
    if (typeof data !== 'string')
        this.doc = data.doc || data;
    else 
       this.doc = jsdom(data, {});

    this.length = this.doc.length || this.doc.childNodes.length || this.doc.body.length || this.doc.body.childNodes.length;

    return this;
}

$.fn = MyJquery.prototype = 
{
    attr: function (name) {
        // It's important to return this if you want to chain methods!
        return this.doc.body.childNodes[0].getAttribute(name);
    },
    find: function (query) {
        var selector = this.doc.querySelectorAll(query);
        return new MyJquery(selector[0].outerHTML);
    },
    text: function(){
        var text;

        if (this.doc.body)
            text = this.doc.body.textContent;
        else {
            var childnode0 = this.doc.childNodes[0];
            while (childnode0.hasChildNodes())
                childnode0 = childnode0.childNodes[0];

            text = childnode0.parentNode.innerHTML;
        }

        text = text.replace(/\s+</g, "<");
        text = text.replace(/>\s+/g, ">");
        text = text.replace(/\/>/g, "></transducer>");
        //text = text.replace(/transducer/g,'img');// make jsdom happy, it doesn't know about transducer tag!
        return text;
    },
    eq: function(i){
        if (!this.length)
            return "";

        for (var j = 0; j < this.length; j++){
            if (i === j)
                if (this.doc.body.childNodes[i])
                    return new MyJquery(this.doc.body.childNodes[i].outerHTML);
                else if (this.doc.body[i])
                    return new MyJquery(this.doc.body[i].outerHTML);
                else if (this.doc[i])
                    return new MyJquery(this.doc[i].outerHTML);
        }
    }
};

var strophe = require("node-strophe").Strophe;
var Strophe = strophe.Strophe;
var $iq = strophe.$iq;
// var Backbone = require("backbone");
var _ = require('underscore');
