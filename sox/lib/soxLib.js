var events = require('events');
var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = require('cheerio');

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

//    XMPP plugins for Strophe v0.3

//    (c) 2012-2013 Yiorgis Gozadinos.
//    configured by Takuro Yonezawa for Sensor-Over-XMPP
//    strophe.plugins is distributed under the MIT license.
//    http://github.com/ggozad/strophe.plugins

// A Pub-Sub plugin partially implementing
// [XEP-0060 Publish-Subscribe](http://xmpp.org/extensions/xep-0060.html)

( function(root, factory) {
	/*
		if ( typeof define === 'function' && define.amd) {
			// AMD. Register as an anonymous module.

			define(['jquery', 'underscore', 'backbone', 'strophe'], function($, _, Backbone, Strophe) {
				// Also create a global in case some scripts
				// that are loaded still are looking for
				// a global even when an AMD loader is in use.
				return factory($, _, Backbone, Strophe);
			});
		} else {
			// Browser globals
			factory(root.$, root._, root.Backbone, root.Strophe);
		}
*/

		factory($, _, Strophe);

	}(this, function($, _, Strophe) {
/*
    This program is distributed under the terms of the MIT license.
    Please see the LICENSE file for details.

    Copyright 2008, Stanziq  Inc.

    Overhauled in October 2009 by Liam Breck [How does this affect copyright?]
*/

/** File: strophe.pubsub.js
 *  A Strophe plugin for XMPP Publish-Subscribe.
 *
 *  Provides Strophe.Connection.pubsub object,
 *  parially implementing XEP 0060.
 *
 *  Strophe.Builder.prototype methods should probably move to strophe.js
 */

/** Function: Strophe.Builder.form
 *  Add an options form child element.
 *
 *  Does not change the current element.
 *
 *  Parameters:
 *    (String) ns - form namespace.
 *    (Object) options - form properties.
 *
 *  Returns:
 *    The Strophe.Builder object.
 */
Strophe.Builder.prototype.form = function (ns, options)
{
    var aX = this.node.appendChild(Strophe.xmlElement('x', {"xmlns": "jabber:x:data", "type": "submit"}));
    aX.appendChild(Strophe.xmlElement('field', {"var":"FORM_TYPE", "type": "hidden"}))
      .appendChild(Strophe.xmlElement('value'))
      .appendChild(Strophe.xmlTextNode(ns));

    for (var i in options) {
        aX.appendChild(Strophe.xmlElement('field', {"var": i}))
        .appendChild(Strophe.xmlElement('value'))
        .appendChild(Strophe.xmlTextNode(options[i]));
    }
    return this;
};

/** Function: Strophe.Builder.list
 *  Add many child elements.
 *
 *  Does not change the current element.
 *
 *  Parameters:
 *    (String) tag - tag name for children.
 *    (Array) array - list of objects with format:
 *          { attrs: { [string]:[string], ... }, // attributes of each tag element
 *             data: [string | XML_element] }    // contents of each tag element
 *
 *  Returns:
 *    The Strophe.Builder object.
 */
Strophe.Builder.prototype.list = function (tag, array)
{
    for (var i=0; i < array.length; ++i) {
        this.c(tag, array[i].attrs)
        this.node.appendChild(array[i].data.cloneNode
                            ? array[i].data.cloneNode(true)
                            : Strophe.xmlTextNode(array[i].data));
        this.up();
    }
    return this;
};

Strophe.Builder.prototype.children = function (object) {
    var key, value;
    for (key in object) {
        if (!object.hasOwnProperty(key)) continue;
        value = object[key];
        if (Array.isArray(value)) {
            this.list(key, value);
        } else if (typeof value === 'string') {
            this.c(key, {}, value);
        } else if (typeof value === 'number') {
            this.c(key, {}, ""+value);
        } else if (typeof value === 'object') {
            this.c(key).children(value).up();
        } else {
            this.c(key).up();
        }
    }
    return this;
};

// TODO Ideas Adding possible conf values?
/* Extend Strophe.Connection to have member 'pubsub'.
 */
Strophe.addConnectionPlugin('PubSub', {
/*
Extend connection object to have plugin name 'pubsub'.
*/
    _connection: null,
    _autoService: true,
    service: null,
    jid: null,
    handler : {},
    events : {},
    eventEmitter : new events.EventEmitter(),
    trigger: function(topic, payload){
        this.eventEmitter.emit(topic, payload);
    },
    on: function(topic, callback){
        this.eventEmitter.on(topic, callback);
    },

    //The plugin must have the init function.
    init: function(conn) {

        this._connection = conn;

        /*
        Function used to setup plugin.
        */

        /* extend name space
        *  NS.PUBSUB - XMPP Publish Subscribe namespace
        *              from XEP 60.
        *
        *  NS.PUBSUB_SUBSCRIBE_OPTIONS - XMPP pubsub
        *                                options namespace from XEP 60.
        */
        Strophe.addNamespace('PUBSUB',"http://jabber.org/protocol/pubsub");
        Strophe.addNamespace('PUBSUB_SUBSCRIBE_OPTIONS',
                             Strophe.NS.PUBSUB+"#subscribe_options");
        Strophe.addNamespace('PUBSUB_ERRORS',Strophe.NS.PUBSUB+"#errors");
        Strophe.addNamespace('PUBSUB_EVENT',Strophe.NS.PUBSUB+"#event");
        Strophe.addNamespace('PUBSUB_OWNER',Strophe.NS.PUBSUB+"#owner");
        Strophe.addNamespace('PUBSUB_AUTO_CREATE',
                             Strophe.NS.PUBSUB+"#auto-create");
        Strophe.addNamespace('PUBSUB_PUBLISH_OPTIONS',
                             Strophe.NS.PUBSUB+"#publish-options");
        Strophe.addNamespace('PUBSUB_NODE_CONFIG',
                             Strophe.NS.PUBSUB+"#node_config");
        Strophe.addNamespace('PUBSUB_CREATE_AND_CONFIGURE',
                             Strophe.NS.PUBSUB+"#create-and-configure");
        Strophe.addNamespace('PUBSUB_SUBSCRIBE_AUTHORIZATION',
                             Strophe.NS.PUBSUB+"#subscribe_authorization");
        Strophe.addNamespace('PUBSUB_GET_PENDING',
                             Strophe.NS.PUBSUB+"#get-pending");
        Strophe.addNamespace('PUBSUB_MANAGE_SUBSCRIPTIONS',
                             Strophe.NS.PUBSUB+"#manage-subscriptions");
        Strophe.addNamespace('PUBSUB_META_DATA',
                             Strophe.NS.PUBSUB+"#meta-data");
        Strophe.addNamespace('ATOM', "http://www.w3.org/2005/Atom");
        Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
        Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');



        if (conn.disco)
            conn.disco.addFeature(Strophe.NS.PUBSUB);

    },

    // Called by Strophe on connection event
    statusChanged: function (status, condition) {
        var that = this._connection;
        // if (this._autoService && status === Strophe.Status.CONNECTED) {
        //     this.service =  'pubsub.'+Strophe.getDomainFromJid(that.jid);
        //     this.jid = that.jid;
        // }

        if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
            this.service =  'pubsub.'+Strophe.getDomainFromJid(that.jid);
            this._connection.addHandler(this._onReceivePEPEventSimple.bind(this), null, 'message', null, null, this.service);
            this.jid = that.jid;
        }
    },

    _onReceivePEPEventSimple : function(msgXML){
        var self = this;

        /**
            data: 

            <body xmlns='http://jabber.org/protocol/httpbind' ack='3493330500'>
            <iq xmlns='jabber:client' type='result' id='6407:pubsub' from='pubsub.sox.ht.sfc.keio.ac.jp' to='67f92022@sox.ht.sfc.keio.ac.jp/67f92022'>
            <pubsub xmlns='http://jabber.org/protocol/pubsub'>
            <subscription node='＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta' jid='67f92022@sox.ht.sfc.keio.ac.jp/67f92022' subid='Oe4ToHgXEHTOv0xINlJ358jHazlUYeiTqE4yHLNJ' subscription='subscribed'>
            <subscribe-options/>
            </subscription></pubsub></iq>
            <message xmlns='jabber:client' from='pubsub.sox.ht.sfc.keio.ac.jp' to='67f92022@sox.ht.sfc.keio.ac.jp/67f92022' id='＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta__67f92022@sox.ht.sfc.keio.ac.jp__s0f55'>
            <event xmlns='http://jabber.org/protocol/pubsub#event'>
            <items node='＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店_meta'>
            <item id='611753bf-c888-42d4-9259-8b912e660bdd325057514'>
                <device xmlns='http://jabber.org/protocol/pubsub' name='＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店' id='＠TOKYO　GRILL　HARBOOR　ららぽーと豊洲店' type='occupancy'>
                   <transducer name='url' id='url'/>
                   <transducer name='latitude' id='latitude'/>
                   <transducer name='longitude' id='longitude'/>
                   <transducer name='店舗名' id='店舗名'/>
                   <transducer name='ジャンル' id='ジャンル'/>
                   <transducer name='TEL' id='TEL'/>
                   <transducer name='交通手段' id='交通手段'/>
                   <transducer name='営業時間' id='営業時間'/>
                   <transducer name='定休日' id='定休日'/>
                   <transducer name='URL' id='URL'/>
                   <transducer name='WEB受付・待ち状況' id='WEB受付・待ち状況'/>
                   <transducer name='住所' id='住所'/>
                </device>
            </item>
            </items></event><delay xmlns='urn:xmpp:delay' stamp='2016-03-18T03:36:33.003Z'/></message></body>
        */
        var to = msgXML.getAttribute('to');
        var from = msgXML.getAttribute('from');
        var fromBareJid = Strophe.getBareJidFromJid(from);
        var type = msgXML.getAttribute('type');
        var delayElem = msgXML.getElementsByTagName('delay')[0];
        var delay = delayElem ? delayElem.getAttribute('stamp') : null;
        var itemElems = msgXML.getElementsByTagName('item');
        for (var i = 0; i < itemElems.length; i++){
            var node = itemElems[i].parentElement.getAttribute('node');
            var id = itemElems[i].getAttribute('id');
            var entry = Strophe.serialize(itemElems[i]);

            if (delay) {
                // PEP event for the last-published item on a node.
                self.trigger('xmpp:pubsub:last-published-item', {
                    node : node,
                    id : id,
                    entry : entry,
                    timestamp : delay
                });
                self.trigger('xmpp:pubsub:last-published-item:' + node, {
                    id : id,
                    entry : entry,
                    timestamp : delay
                });
            } else {
                // PEP event for an item newly published on a node.
                self.trigger('xmpp:pubsub:item-published', {
                    node : node,
                    id : id,
                    entry : entry
                });
                self.trigger('xmpp:pubsub:item-published:' + node, {
                    id : id,
                    entry : entry
                });
            }
        }

        var retractElems = msgXML.getElementsByTagName('retract');
        for (var i = 0; i < retractElems.length; i++){
            var node = retractElems[i].parentElement.getAttribute('node');
            var id = retractElems[i].getAttribute('id');
            self.trigger('xmpp:pubsub:item-deleted', {
                node : node,
                id : id
            });
            self.trigger('xmpp:pubsub:item-deleted:' + node, {
                id : id
            });
        }

        return true;
    },
    // Handle PEP events and trigger own events.
    // _onReceivePEPEvent : function(ev) {

    //     console.log('--------------------------------------------------------------');
    //     console.log(ev);
    //     console.log('--------------------------------------------------------------');

    //     var self = this;
    //     var delay = $('delay[xmlns="' + Strophe.NS.DELAY + '"]', ev).attr('stamp');

    //     $('item', ev).each(function(idx, item) {

    //         var node = $(item).parent().attr('node'), id = $(item).attr('id'), entry = Strophe.serialize($(item)[0]);

    //         if (delay) {
    //             // PEP event for the last-published item on a node.
    //             self.trigger('xmpp:pubsub:last-published-item', {
    //                 node : node,
    //                 id : id,
    //                 entry : entry,
    //                 timestamp : delay
    //             });
    //             self.trigger('xmpp:pubsub:last-published-item:' + node, {
    //                 id : id,
    //                 entry : entry,
    //                 timestamp : delay
    //             });
    //         } else {
    //             // PEP event for an item newly published on a node.
    //             self.trigger('xmpp:pubsub:item-published', {
    //                 node : node,
    //                 id : id,
    //                 entry : entry
    //             });
    //             self.trigger('xmpp:pubsub:item-published:' + node, {
    //                 id : id,
    //                 entry : entry
    //             });
    //         }
    //     });

    //     // PEP event for the item deleted from a node.
    //     $('retract', ev).each(function(idx, item) {
    //         var node = $(item).parent().attr('node'), id = $(item).attr('id');
    //         self.trigger('xmpp:pubsub:item-deleted', {
    //             node : node,
    //             id : id
    //         });
    //         self.trigger('xmpp:pubsub:item-deleted:' + node, {
    //             id : id
    //         });
    //     });

    //     return true;
    // },
    /***Function

    Parameters:
    (String) jid - The node owner's jid.
    (String) service - The name of the pubsub service.
    */
    connect: function (jid, service) {
        var that = this._connection;
        if (service === undefined) {
            service = jid;
            jid = undefined;
        }
        this.jid = jid || that.jid;
        this.service = service || null;
        this._autoService = false;
    },

    /***Function

     Parameters:
     (String) node - The name of node
     (String) handler - reference to registered strophe handler
     */
    storeHandler: function(node, handler) {
        if (!this.handler[node]) {
            this.handler[node] = [];
        }
        this.handler[node].push(handler);
    },

    /***Function

     Parameters:
     (String) node - The name of node
     */
    removeHandler : function (node) {

        var toberemoved = this.handler[node];
        this.handler[node] = [];

        // remove handler
        if (toberemoved && toberemoved.length > 0) {
            for (var i = 0, l = toberemoved.length; i < l; i++) {
                this._connection.deleteHandler(toberemoved[i])
            }
        }
    },

    /***Function

    Create a pubsub node on the given service with the given node
    name.

    Parameters:
    (String) node -  The name of the pubsub node.
    (Dictionary) options -  The configuration options for the  node.
    (Function) call_back - Used to determine if node
    creation was sucessful.

    Returns:
    Iq id used to send subscription.
    */
    createNode: function(node,options, call_back) {
        var that = this._connection;

        var iqid = that.getUniqueId("pubsubcreatenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB})
          .c('create',{node:node});
        if(options) {
            iq.up().c('configure').form(Strophe.NS.PUBSUB_NODE_CONFIG, options);
        }

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());
        return iqid;
    },

    /** Function: deleteNode
     *  Delete a pubsub node.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) call_back - Called on server response.
     *
     *  Returns:
     *    Iq id
     */
    deleteNode: function(node, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubdeletenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB_OWNER})
          .c('delete', {node:node});

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /** Function
     *
     * Get all nodes that currently exist.
     *
     * Parameters:
     *   (Function) success - Used to determine if node creation was sucessful.
     *   (Function) error - Used to determine if node
     * creation had errors.
     */
    discoverNodes: function(success, error, timeout) {

        //ask for all nodes
        var iq = $iq({from:this.jid, to:this.service, type:'get'})
          .c('query', { xmlns:Strophe.NS.DISCO_ITEMS });

        return this._connection.sendIQ(iq.tree(),success, error, timeout);
    },

    /** Function: getConfig
     *  Get node configuration form.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) call_back - Receives config form.
     *
     *  Returns:
     *    Iq id
     */
    getConfig: function (node, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubconfigurenode");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB_OWNER})
          .c('configure', {node:node});

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /**
     *  Parameters:
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.3 Request Default Node Configuration Options
     *
     *  Returns:
     *    Iq id
     */
    getDefaultNodeConfig: function(call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubdefaultnodeconfig");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
          .c('default');

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /***Function
        Subscribe to a node in order to receive event items.

        Parameters:
        (String) node         - The name of the pubsub node.
        (Array) options       - The configuration options for the  node.
        (Function) event_cb   - Used to recieve subscription events.
        (Function) success    - callback function for successful node creation.
        (Function) error      - error callback function.
        (Boolean) barejid     - use barejid creation was sucessful.

        Returns:
        Iq id used to send subscription.
    */
    subscribe: function(node, options, event_cb, success, error, barejid) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsub");

        var jid = this.jid;
        if(barejid)
            jid = Strophe.getBareJidFromJid(jid);

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('subscribe', {'node':node, 'jid':jid});
        if(options) {
            iq.up().c('options').form(Strophe.NS.PUBSUB_SUBSCRIBE_OPTIONS, options);
        }

        //add the event handler to receive items
        var hand = that.addHandler(event_cb, null, 'message', null, null, null);
        this.storeHandler(node, hand);
        that.sendIQ(iq.tree(), success, error);
        return iqid;
    },

    /***Function
        Unsubscribe from a node.

        Parameters:
        (String) node       - The name of the pubsub node.
        (Function) success  - callback function for successful node creation.
        (Function) error    - error callback function.

    */
    unsubscribe: function(node, jid, subid, success, error) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubunsubscribenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('unsubscribe', {'node':node, 'jid':jid});
        if (subid) iq.attrs({subid:subid});

        that.sendIQ(iq.tree(), success, error);
        this.removeHandler(node);
        return iqid;
    },

    /***Function

    Publish and item to the given pubsub node.

    Parameters:
    (String) node -  The name of the pubsub node.
    (Array) items -  The list of items to be published.
    (Function) call_back - Used to determine if node
    creation was sucessful.
    */
    publish: function(node, items, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubpublishnode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('publish', { node:node, jid:this.jid })
          .list('item', items);

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /*Function: items
    Used to retrieve the persistent items from the pubsub node.

    */
    items: function(node, success, error, timeout) {
        //ask for all items
        var iq = $iq({from:this.jid, to:this.service, type:'get'})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('items', {node:node});

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function: getSubscriptions
     *  Get subscriptions of a JID.
     *
     *  Parameters:
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  5.6 Retrieve Subscriptions
     *
     *  Returns:
     *    Iq id
     */
    getSubscriptions: function(call_back, timeout) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubsubscriptions");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB})
          .c('subscriptions');

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /** Function: getNodeSubscriptions
     *  Get node subscriptions of a JID.
     *
     *  Parameters:
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  5.6 Retrieve Subscriptions
     *
     *  Returns:
     *    Iq id
     */
    getNodeSubscriptions: function(node, call_back) {
        var that = this._connection;
       var iqid = that.getUniqueId("pubsubsubscriptions");

       var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
         .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
         .c('subscriptions', {'node':node});

       that.addHandler(call_back, null, 'iq', null, iqid, null);
       that.send(iq.tree());

       return iqid;
    },

    /** Function: getSubOptions
     *  Get subscription options form.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (String) subid - The subscription id (optional).
     *    (Function) call_back - Receives options form.
     *
     *  Returns:
     *    Iq id
     */
    getSubOptions: function(node, subid, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubsuboptions");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB})
          .c('options', {node:node, jid:this.jid});
        if (subid) iq.attrs({subid:subid});

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /**
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.9 Manage Affiliations - 8.9.1.1 Request
     *
     *  Returns:
     *    Iq id
     */
    getAffiliations: function(node, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubaffiliations");

        if (typeof node === 'function') {
            call_back = node;
            node = undefined;
        }

        var attrs = {}, xmlns = {'xmlns':Strophe.NS.PUBSUB};
        if (node) {
            attrs.node = node;
            xmlns = {'xmlns':Strophe.NS.PUBSUB_OWNER};
        }

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:iqid})
          .c('pubsub', xmlns).c('affiliations', attrs);

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /**
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.9.2 Modify Affiliation - 8.9.2.1 Request
     *
     *  Returns:
     *    Iq id
     */
    setAffiliation: function(node, jid, affiliation, call_back) {
        var that = this._connection;
        var iqid = that.getUniqueId("pubsubaffiliations");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
          .c('affiliations', {'node':node})
          .c('affiliation', {'jid':jid, 'affiliation':affiliation});

        that.addHandler(call_back, null, 'iq', null, iqid, null);
        that.send(iq.tree());

        return iqid;
    },

    /** Function: publishAtom
     */
    publishAtom: function(node, atoms, call_back) {
        if (!Array.isArray(atoms))
            atoms = [atoms];

        var i, atom, entries = [];
        for (i = 0; i < atoms.length; i++) {
            atom = atoms[i];

            atom.updated = atom.updated || (new Date()).toISOString();
            if (atom.published && atom.published.toISOString)
                atom.published = atom.published.toISOString();

            entries.push({
                data: $build("entry", { xmlns:Strophe.NS.ATOM })
                        .children(atom).tree(),
                attrs:(atom.id ? { id:atom.id } : {}),
            });
        }
        return this.publish(node, entries, call_back);
    },

});
	}));

/**
 * BOSHサービス(HTTP-XMPPブリッジ)のURLとXMPPサーバホスト名、ノード名を
 * 指定して、SoxClientを作成する。ノード名には_dataや_metaを除いた部分を 指定する。
 */

function SoxClient(boshService, xmppServer, jid, password) {
	// server information
	this.boshService = boshService;
	this.xmppServer = xmppServer;
	// admin credentials
	this.jid = jid;
	this.password = password;
	this.authenticated = false;
	this.connection = null;
	this.soxEventListener = null;
	this.subscribedDevices = new Array();
	    this.isAnonymousAllowed = true;

}

SoxClient.prototype.toString = function() {
	return "[SoxClient xmppServer=" + this.xmppServer + ", authenticated=" + this.authenticated + ", connected=" + this.isConnected() + "]";
};

SoxClient.prototype.rawInput = function(data) {
	if (window.console) {
		console.log("RECV: " + data);
	}
};

SoxClient.prototype.rawOutput = function(data) {
	if (window.console) {
		console.log("SENT: " + data);
	}
};

SoxClient.prototype.isConnected = function() {
	return (this.connection != null) && this.connection.connected;
};

/**
 * Establishes a connection to the server specified in the constructor,
 */
SoxClient.prototype.connect = function() {
	this.connection = new Strophe.Connection(this.boshService);
	this.connection.rawInput = this.rawInput;
	this.connection.rawOutput = this.rawOutput;
	var me = this;
	var callback = function(status) {
		if (status == Strophe.Status.CONNECTING) {
			console.log('[SoxClient.js] Connecting...');
		} else if (status == Strophe.Status.CONNFAIL) {
			console.log('[SoxClient.js] Connection failed');
			if (me.soxEventListener) {
				me.soxEventListener.connectionFailed({
					soxClient : me
				});
			}
		} else if (status == Strophe.Status.DISCONNECTING) {
			console.log('[SoxClient.js] Disconnecting...');
		} else if (status == Strophe.Status.DISCONNECTED) {
			console.log('[SoxClient.js] Disconnected');
			if (me.soxEventListener) {
				me.soxEventListener.disconnected({
					soxClient : me
				});
			}
		} else if (status == Strophe.Status.CONNECTED) {
			if (me.jid && me.password) {
				// if jid and password are given, we are authenticated by the
				// server
				me.authenticated = true;
			}
			console.log("[SoxClient.js] Connected to " + me);
			me.connection.send(new Strophe.Builder("presence").c('priority').t('-1')); //NOTE: this works

			me.connection.PubSub.on('xmpp:pubsub:last-published-item', function(obj) {
				try {
					me._processLastPublishedItem(obj.node, obj.id, obj.entry, obj.timestamp);
				} catch (e) {
					printStackTrace(e);
				}
			});
			me.connection.PubSub.on('xmpp:pubsub:item-published', function(obj) {
				try {
					me._processPublishedItem(obj.node, obj.id, obj.entry);
				} catch (e) {
					printStackTrace(e);
				}
			});
			if (me.soxEventListener) {
				me.soxEventListener.connected({
					soxClient : me
				});
			}
		}
		return true;
	};

	if (this.jid && this.password) {
		this.connection.connect(this.jid, this.password, callback);
	} else {
		this.connection.connect(this.xmppServer + "/pubsub", "", callback);
	}

	return true;

};

/**
 * Disconnect from server
 */
SoxClient.prototype.disconnect = function() {
	console.log("Disconnect from server initiated")
	if (!this.connection || !this.authenticated) {
		return false;
	}

	this.connection.disconnect("Because I want to...");
	return true;
};

/**
 * jQueryオブジェクトをダンプする
 */
/*
(function($){
	$.fn.dump = function(){
		var elements = this;
		var dumphtml = [];

		elements.each(function(){
			var element = $(this);
			if($.browser.msie) {
				for(var i = 0; i < element.length; i++) {
					dumphtml.push(element[i].outerHTML.replace(/^[\r\n\t]+/, ''));
					dumphtml.push("\n");
				}
			} else {
				for(var i = 0; i < element.length; i++) {
					dumphtml.push('<' + element[i].nodeName.toLowerCase());
					for(var j = 0; j < element[i].attributes.length; j++) {
						dumphtml.push(' ' + element[i].attributes[j].nodeName + '="'
							+ element[i].attributes[j].nodeValue + '"');
					}
					dumphtml.push('>' + element[i].innerHTML);
					dumphtml.push('<\/' + element[i].nodeName.toLowerCase() + '>');
					dumphtml.push("\n");
				}
			}
		});
		alert(dumphtml.join(''));

		return this;
	};
})(jQuery);

var jQuery = require('jquery');
var $ = require('jquery');
*/

SoxClient.prototype.resolveDevice = function(device) {
	if(!this.isAnonymousAllowed){
    	if (!this.connection || !this.authenticated) {
    		return false;
    	}
    } else if (!this.connection){
        return false;
    }

	var me = this;
	console.log("[SoxClient.js] resolveDevice name=" + device.nodeName);
	var successCallback = function(data) {
		/* dataは以下のような感じ
		<body xmlns='http://jabber.org/protocol/httpbind'><presence xmlns='jabber:client' from='sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044' to='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524'><priority>-1</priority><delay xmlns='urn:xmpp:delay' from='sensorizer@sox.ht.sfc.keio.ac.jp/9719511701413823240149044' stamp='2014-10-20T16:40:40Z'/><x xmlns='jabber:x:delay' stamp='20141020T16:40:40'/></presence><presence xmlns='jabber:client' from='sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773' to='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524'><priority>-1</priority><delay xmlns='urn:xmpp:delay' from='sensorizer@sox.ht.sfc.keio.ac.jp/937465781413816191856773' stamp='2014-10-20T14:43:12Z'/><x xmlns='jabber:x:delay' stamp='20141020T14:43:12'/></presence><presence xmlns='jabber:client' from='sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828' to='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524'><priority>-1</priority><delay xmlns='urn:xmpp:delay' from='sensorizer@sox.ht.sfc.keio.ac.jp/27765683871413823264621828' stamp='2014-10-20T16:41:05Z'/><x xmlns='jabber:x:delay' stamp='20141020T16:41:05'/></presence><presence xmlns='jabber:client' from='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524' to='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524'><priority>-1</priority></presence><iq xmlns='jabber:client' from='pubsub.sox.ht.sfc.keio.ac.jp' to='sensorizer@sox.ht.sfc.keio.ac.jp/4256993771413823283837524' id='1:sendIQ' type='result'><pubsub xmlns='http://jabber.org/protocol/pubsub'><items node='しらすの入荷情報湘南_meta'><item id='metaInfo'><device name='しらすの入荷情報湘南' type='outdoor weather'>&lt;transducer name=&apos;url&apos; id=&apos;url&apos; /&gt;
		&lt;transducer name=&apos;入荷情報&apos; id=&apos;入荷情報&apos; /&gt;
		&lt;transducer name=&apos;latitude&apos; id=&apos;latitude&apos; /&gt;
		&lt;transducer name=&apos;longitude&apos; id=&apos;longitude&apos; /&gt;
		&lt;transducer name=&apos;天気&apos; id=&apos;天気&apos; /&gt;
		&lt;transducer name=&apos;気温&apos; id=&apos;気温&apos; units=&apos;℃&apos; /&gt;
		</device></item></items></pubsub></iq></body>
		**/
		//$(data).dump();
		try {
			var deviceElement = $(data).find('device');
			device.name = $(deviceElement).attr('name');
			device.type = $(deviceElement).attr('type');

			var transducerElements = $($(data).text());
			for (var i = 0; i < transducerElements.length; i++) {
				var transducer = Transducer.fromXML(transducerElements.eq(i));
				if (device.getTransducer(transducer.id)) {
					continue;
				}
				device.addTransducer(transducer);
				console.log("[SoxClient.js] SoxClient::resolveDevice: Created " + transducer);
			}
			if (me.soxEventListener) {
				me.soxEventListener.resolved({
					soxClient : me,
					device : device,
				});
			}
		} catch (e) {
			printStackTrace(e);
			if (me.soxEventListener) {
				me.soxEventListener.resolveFailed({
					soxClient : me,
					device : device,
				});
			}
		}
	};
	var failureCallback = function(data) {
		console.log("[SoxClient.js] resolve failed. device=" + device);
		if (me.soxEventListener) {
			me.soxEventListener.resolveFailed({
				soxClient : me,
				device : device,
			});
		}
	};
	this.connection.PubSub.items(device.nodeName + "_meta", successCallback, failureCallback);
};

/**
 * Creates a new SoX device with XMPP nodes xxx_data and xxx_meta on the server
 *
 * @param device
 *            device instance
 * @param accessModel
 *            open, authorize, whitelist, presence, or roster
 * @param publishModel
 *            open, publishers, or subscribers
 * @return false if this is not connected to the server or the connection is not
 *         authenticated
 */
SoxClient.prototype.createDevice = function(device) {
	if (!this.isConnected() || !this.authenticated) {
		console.log("[SoxClient.js] not connected.");
		return false;
	}
	var me = this;
	var failureCallback = function(data) {
		/**
		 * creation failure! data is iq element [server reply (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/1376813336139165838253271'
		 * type='error' id='18:pubsub'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <create node='hoge_meta'/>
		 * <configure> <x xmlns='jabber:x:data' type='submit'> <field
		 * type='hidden' var='FORM_TYPE'>
		 * <value>http://jabber.org/protocol/pubsub#node_config</value>
		 * </field> <field type='text-single' var='pubsub#access_model'>
		 * <value>open</value> </field> <field type='text-single'
		 * var='pubsub#publish_model'> <value>open</value> </field> <field
		 * type='text-single' var='pubsub#max_items'> <value>1</value> </field>
		 * </x> </configure> </pubsub> <error code='409' type='cancel'>
		 * <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/> </error>
		 * </iq> </body>
		 */
		var nodeName = $(data).find('create').attr('node');
		var errorCode = $(data).find('error').attr('code');
		console.log("Failed to create: " + nodeName);
		if (me.soxEventListener) {
			me.soxEventListener.creationFailed({
				soxClient : me,
				device : device,
				nodeName : nodeName,
				errorCode : errorCode
			});
		}
	};

	var successMetaCallback = function(data) {
		/**
		 * creation successfull! data is iq element [server reply (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/1376813336139165838253271'
		 * id='15:pubsub' type='result'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <create node='hoge_data'/>
		 * </pubsub> </iq> </body>
		 */
		var nodeName = $(data).find("create").attr("node");
		console.log("Created: " + nodeName);
		if (me.soxEventListener) {
			me.soxEventListener.created({
				soxClient : me,
				device : device
			});
		}
		device.setMetaDirty(true);
	};

	var successDataCallback = function(data) {
		/* postpone setting data dirty flag till actual data is set */
		// device.setDataDirty(true);
		var nodeName = $(data).find("create").attr("node");
		console.log("[SoxClient.js] Created: " + nodeName);
		// create _meta node
		me.connection.PubSub.createNode(device.nodeName + "_meta", {
			'pubsub#access_model' : device.accessModel,
			'pubsub#publish_model' : device.publishModel,
			'pubsub#max_items' : 1
		}, successMetaCallback, failureCallback);
	};
	console.log("[SoxClient.js] Creating " + device.nodeName);

	// first create _data node
	this.connection.PubSub.createNode(device.nodeName + "_data", {
		'pubsub#access_model' : device.accessModel,
		'pubsub#publish_model' : device.publishModel,
		'pubsub#max_items' : 1
	}, successDataCallback, failureCallback);

	return true;
};

/**
 * Delets a SoX device with XMPP nodes xxx_data and xxx_meta on the server
 *
 * @param device
 *            the device to delete
 * @return false if this is not connected to the server or the connection is not
 *         authenticated
 */
SoxClient.prototype.deleteDevice = function(device) {
	if (!this.isConnected() || !this.authenticated) {
		return false;
	}
	var me = this;
	// callback for _meta node deletion
	var successMetaCallback = function(data) {
		/**
		 * deletion successful [server response (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/207117033513916731381698'
		 * id='6:pubsub' type='result'/> </body>
		 */
		console.log("[SoxClient.js] Deleted: " + device.nodeName + "_meta");
		if (me.soxEventListener) {
			me.soxEventListener.deleted({
				soxClient : me,
				device : device
			});
		}
	};
	// callback for _data node deletion
	var successDataCallback = function(data) {
		console.log("[SoxClient.js] Deleted: " + device.nodeName + "_data");
		me.connection.PubSub.deleteNode(device.nodeName + "_meta", successMetaCallback, failureCallback);
	};
	// callback for errors
	var failureCallback = function(data) {
		/**
		 * deletion failed [server response (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/1187778913139167712338840'
		 * type='error' id='7:pubsub'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub#owner'> <delete
		 * node='hoge_data'/> </pubsub> <error code='404' type='cancel'>
		 * <item-not-found xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
		 * </error> </iq> </body>
		 */
		var nodeName = $(data).find('delete').attr('node');
		var errorCode = $(data).find('error').attr('code');
		console.log("[SoxClient.js] Failed to delete: " + device.nodeName + " code=" + errorCode);
		if (me.soxEventListener) {
			me.soxEventListener.deletionFailed({
				soxClient : me,
				device : device,
				nodeName : nodeName,
				errorCode : errorCode
			});
		}
	};

	console.log("[SoxClient.js] Deleting " + device);
	this.connection.PubSub.deleteNode(device.nodeName + "_data", successDataCallback, failureCallback);

	return true;
};

/**
 * Discover all the devices created on the server. If a query is given, this
 * function tries to find the device that has the string in the query as its
 * basename.
 *
 * QUERY RESULT N/A All devices abc The device having abc_meta and abc_data
 */
SoxClient.prototype.discoverDevices = function(query) {
	if (!this.isConnected()) {
		return false;
	}

	var me = this;
	var successCallback = function(data) {
		console.log("[SoxClient.js] data={" + data + "}");
		var devices = new Array();
		if (Array.isArray(data)) {
			data.forEach(function(node) {
				console.log(">>>>> node=" + node);
				if (node.indexOf('_meta') != -1) {
					var nodeBaseName = node.substr(0, node.length - 5);
					if (query && query == nodeBaseName) {
						/*
						 * query is given and the query matches to the device
						 * node name
						 */
						devices.push(new Device(nodeBaseName));
						console.log(node.substr(0, node.length - 5));
					} else if (!query) {
						/* no query is given */
						devices.push(new Device(nodeBaseName));
						console.log(node.substr(0, node.length - 5));
					}
				}
			});
		}
		if (me.soxEventListener) {
			me.soxEventListener.discovered({
				soxClient : me,
				devices : devices
			});
		}
	};

	var failureCallback = function(data) {
		console.log("[SoxClient.js] SoxClient.discoverNodes.failureCallback: " + JSON.stringify(data));
		if (me.soxEventListener) {
			me.soxEventListener.discoveryFailed({
				soxClient : me
			});
		}
	};

	// if(query){
	// this.connection.PubSub.discoverNodes(query+"_meta", successCallback, failureCallback);
	// }else{
	this.connection.PubSub.discoverNodes( successCallback, failureCallback);
	// }
	return true;
};

SoxClient.prototype.publishDevice = function(device) {
	if (!this.isConnected()) {
		return false;
	}
	var me = this;
	var successMetaCallback = function(data) {
		/**
		 * <body xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/28891197051391135161948900'
		 * id='3:pubsub' type='result'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <publish node='nodeName'>
		 * <item id='metaInfo'/> </publish> </pubsub> </iq> </body>
		 */
		var nodeName = $(data).find('publish').attr('node');
		console.log("[SoxClient.js] Published: " + device.name + "_meta");
		device.setMetaDirty(false);
		if (me.soxEventListener) {
			me.soxEventListener.published({
				soxClient : me,
				nodeName : device.name + "_meta",
				device : device
			});
		}
	};

	var successDataCallback = function(data) {
		/**
		 * <body xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/28891197051391135161948900'
		 * id='3:pubsub' type='result'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <publish node='nodeName'>
		 * <item id='metaInfo'/> </publish> </pubsub> </iq> </body>
		 */
		var nodeName = $(data).find('publish').attr('node');
		console.log("[SoxClient.js] Published: " + device.name + "_data");
		device.setDataDirty(false);
		if (me.soxEventListener) {
			me.soxEventListener.published({
				soxClient : me,
				nodeName : device.name + "_data",
				device : device
			});
		}
	};
	var failureCallback = function(data) {
		console.log("[SoxClient.js] Publish Failed: ");
	};

	if (device.isDataDirty()) {
		this.connection.PubSub.publish(device.nodeName + "_data", new Strophe.Builder('data').t(device.toDataString()).tree(), device.nodeName + "_data", 
				successDataCallback, failureCallback);
	}

	if (device.isMetaDirty()) {
		this.connection.PubSub.publish(device.nodeName + "_meta", new Strophe.Builder('device', {
			name : device.name,
			type : device.type
		}).t(device.toMetaString()).tree(), 'metaInfo', successMetaCallback, failureCallback);
	}

	return true;
};

/**
 * このデバイスをサブスクライブする。サブスクライブに失敗したら、このインスタンスを 例外として投げる。サブスクライブに成功したらコールバック関数を呼び出す。
 * This function returns true when a subscription request has been sent to the
 * server without waiting for its reply. If you need to be reminded when the
 * request has been processed, please register a soxEventListener using
 * setsoxEventListener method. If connection is not yet made, this function
 * returns false. It also returns false if the device is already subscribed.
 */
SoxClient.prototype.subscribeDevice = function(device) {
	if (!device) {
		console.log("[SoxClient.js] device is undefined.");
		return false;
	}
	if (!this.isConnected() || (device.metaSubscribed && device.dataSubscribed)) {
		return false;
	}
	console.log("[SoxClient.js] SoxClient::subscribeDevice: Subscribing " + device.toString());
	var me = this;
	this.subscribedDevices[device.nodeName] = device;

	var dummyCallback = function(data){};

	var successDataCallback = function(data) {
		device.dataSubid = $(data).find('subscription').attr('subid');
		device.dataSubscribed = true;
		console.log("[SoxClient.js] SoxClient::subscribeDevice: Subscribed: " + device.nodeName + "_data");
		if (me.soxEventListener) {
			me.soxEventListener.subscribed({
				soxClient : me,
				device : device
			});
		}
	};
	var successMetaCallback = function(data) {
		/**
		 * subscription successfull [server response (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <message
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983'> <event
		 * xmlns='http://jabber.org/protocol/pubsub#event'> <items
		 * node='hoge_meta'/> </event> </message> <iq xmlns='jabber:client'
		 * from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983'
		 * id='9:pubsub' type='result'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <subscription
		 * jid='guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983'
		 * subscription='subscribed' subid='56F1130152627' node='hoge_meta'/>
		 * </pubsub> </iq> </body>
		 */
		device.metaSubid = $(data).find('subscription').attr('subid');
		device.metaSubscribed = true;
		console.log("[SoxClient.js] SoxClient::subscribeDevice: Subscribed: " + device.nodeName + "_meta");
		me.connection.PubSub.subscribe(device.nodeName + "_data", null, dummyCallback, successDataCallback, failureCallback);
	};
	var failureCallback = function(data) {
		/**
		 * subscription failure [server response (data)] <body
		 * xmlns='http://jabber.org/protocol/httpbind'> <iq
		 * xmlns='jabber:client' from='pubsub.ps.ht.sfc.keio.ac.jp'
		 * to='guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983'
		 * type='error' id='12:pubsub'> <pubsub
		 * xmlns='http://jabber.org/protocol/pubsub'> <subscribe
		 * node='hoge_data'
		 * jid='guest@ps.ht.sfc.keio.ac.jp/2473748927139170367828983'/>
		 * </pubsub> <error code='404' type='cancel'> <item-not-found
		 * xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/> </error> </iq> </body>
		 */
		var nodeName = $(data).find('subscribe').attr('node');
		var errorCode = $(data).find('error').attr('code');
		delete me.subscribedDevices[device.nodeName];
		console.log("[SoxClient.js] SoxClient::subscribeDevice: Subscription Failed: " + nodeName);
		if (me.soxEventListener) {
			me.soxEventListener.subscriptionFailed({
				device : device,
				nodeName : nodeName,
				errorCode : errorCode
			});
		}
	};

	/**
	 * we first subscribe _meta node so that Device instance is successfully
	 * generated before receiving last published item of corresponding _data
	 * node
	 */
	//TODO: throws an error
	this.connection.PubSub.subscribe(device.nodeName + "_meta", null, dummyCallback, successMetaCallback, failureCallback);

	return true;
};

/**
 * Unsubscribes from the device. This function returns true when a
 * unsubscription request has been sent to the server without waiting for its
 * reply. If you need to be reminded when the request has been processed, please
 * register a soxEventListener using setsoxEventListener method. If connection
 * is not yet made, this function returns false.
 */
SoxClient.prototype.unsubscribeDevice = function(device) {
	if (!this.isConnected() || (!device.metaSubscribed && !device.dataSubscribed)) {
		return false;
	}
	console.log("[SoxClient.js] Unsubscribing " + device.toString());

	var me = this;
	var successMetaCallback = function(data) {
		device.metaSubid = null;
		device.metaSubscribed = false;
		delete this.subscribedDevices[device.nodeName];
		if (me.soxEventListener) {
			me.soxEventListener.unsubscribed({
				soxClient : me,
				device : device,
				nodeName : nodeName
			});
		}
		console.log("[SoxClient.js] Unsubscribed: " + device);
	};
	var successDataCallback = function(data) {
		device.dataSubid = null;
		device.dataSubscribed = false;
		this.connection.PubSub.unsubscribe(device.nodeName + "_meta", successMetaCallback, failureCallback);
	};
	var failureCallback = function(data) {
		var nodeName = $(data).find('subscription').attr('node');
		console.log("[SoxClient.js] Unsubscription Failed: " + nodeName);
		if (me.soxEventListener) {
			me.soxEventListener.unsubscriptionFailed({
				soxClient : me,
				device : device,
				nodeName : nodeName
			});
		}
	};

	// first subscribe _data node
	this.connection.PubSub.unsubscribe(device.nodeName + "_data", successDataCallback ,failureCallback);

	return true;
};

/**
 * Unsubscribes from all subscription
 */
SoxClient.prototype.unsubscribeAll = function() {
	if (!this.isConnected()) {
		return false;
	}

	var me = this;
	var successCallback = function(data) {
		/**
		 * parameter "data" is an array of the following objects
		 * {"node":"Air_at_Fujisawa_Goshomi_Elementary_School_data",
		 * "jid":"guest@sox.ht.sfc.keio.ac.jp/24963379221399978317593251",
		 * "subid":"577EEDA9B051F", "subscription":"subscribed"}
		 */
		for (var i = 0; i < data.length && i < 100; i++) {
			// console.log("SoxClient.unsubscribeAll: node="+data[i].node+",
			// jid="+data[i].jid+", subid="+data[i].subid);
			console.log("[SoxClient.js] SoxClient.unsubscribeAll: # of subscription=" + data.length);
			me.connection.PubSub.unsubscribe(data[i].node, data[i].jid, data[i].subid, function() {
				var now = new Date();
				console.log("[SoxClient.js] " + now + " unsubscribed " + data[i].node + ", " + data[i].jid);
			}, function() {
				console.log("[SoxClient.js] failed to unsubscribe " + data[i].node + ", " + data[i].jid);
			});
		}
		if (data.length > 1) {
			me.unsubscribeAll();
		}
	};

	var failureCallback = function(data) {
		console.log("[SoxClient.js] SoxClient.getSubscriptions.failureCallback: " + data);
	};

	// first subscribe _data node
	this.connection.PubSub.getSubscriptions( successCallback, failureCallback);

	return true;
};

/**
 * Checks if the node with specified name exists on the specified server
 *
 * @param callback
 * @param callbackArg
 */
SoxClient.prototype.exists = function(nodeName) {
	return false;
};

/**
 * Registers a listener object to this device.
 *
 * @param soxEventListener
 *            SoxEventListener instance
 */
SoxClient.prototype.setSoxEventListener = function(soxEventListener) {
	this.soxEventListener = soxEventListener;
};

SoxClient.prototype.getSoxEventListener = function() {
	return this.soxEventListener;
};

/**
 * Returns an instance of Device whose name is equal to the specified one
 *
 * @param name
 *            XMPP node name without _data or _meta or the device name
 */
SoxClient.prototype.getDevice = function(name) {

};

/**
 * Process the last published item on the specified node, which is given by the
 * server right after a subscription.
 */
SoxClient.prototype._processLastPublishedItem = function(node, id, entry, timestamp) {
	// replace special character to tags
	entry = entry.toString().replace(/&lt;/g, "<");
	entry = entry.toString().replace(/&gt;/g, ">");
	entry = entry.toString().replace(/&apos;/g, "'");

	var nodeName = node.substring(0, node.indexOf("_"));
	if (!this.subscribedDevices[nodeName]) {
		// we come here if a node is subscribed during the past execution of the
		// program.
		// this happens because XMPP server is stateful.
		this.subscribedDevices[nodeName] = new Device(nodeName);
	}

	if (node.indexOf('_meta') != -1) {
		var deviceElement = $(entry).find('device');
		this.subscribedDevices[nodeName].name = $(deviceElement).attr('name');
		this.subscribedDevices[nodeName].type = $(deviceElement).attr('type');

		var transducerElements = $(entry).find("transducer");
		for (var i = 0; i < transducerElements.length; i++) {
			var transducer = Transducer.fromXML(transducerElements.eq(i));
			if (this.subscribedDevices[nodeName].getTransducer(transducer.id)) {
				continue;
			}
			this.subscribedDevices[nodeName].addTransducer(transducer);
			console.log("[SoxClient.js] SoxClient::_processLastPublishedItem: Created " + transducer);
		}

		/*
		 * if (this.soxEventListener) { this.soxEventListener.metaDataReceived({
		 * soxClient : this, device : this.subscribedDevices[nodeName], }); }
		 */
	} else if (node.indexOf("_data") != -1) {
		var updatedTransducers = new Array();
		var transducerValues = $(entry).find("transducerValue");

		// var transducerValues = $(entry).find("transducerValue");
		for (var i = 0; i < transducerValues.length; i++) {
			var data = SensorData.fromXMLString(transducerValues.eq(i));
			if (!data) {
				/* Transducerに値が入っていないとき、上の関数はnullを返す。ので、それの処理を飛ばす */
				continue;
			}
			console.log(data)
			var transducer = this.subscribedDevices[nodeName].getTransducer(data.id);
			if (!transducer) {
				console.log("[SoxClient.js] no transducer found for " + data.toString());
				continue;
			} else if (transducer.setSensorData(data)) {
				updatedTransducers.push(transducer);
			}
			console.log("[SoxClient.js] SoxClient::_processLastPublishedItem: Received " + data.toString());
		}


		 if (this.soxEventListener) {
		 this.soxEventListener.sensorDataReceived({ soxClient : this, device :
		 this.subscribedDevices[nodeName], transducers : updatedTransducers
		 }); }

	}
	console.log("[SoxClient.js] SoxClient::_processLastPublishedItem:  finished");
	return true;
};

/**
 * サーバから非同期に送られてくる最新アイテムを処理する
 */
// var cheerio = require('cheerio')

SoxClient.prototype._processPublishedItem = function(node, id, entry) {
	// For soxPublisher.html, replace special character to tags
	entry = entry.toString().replace(/&lt;/g, "<");
	entry = entry.toString().replace(/&gt;/g, ">");
	entry = entry.toString().replace(/&apos;/g, "'");
	// alert("processPublishedItem: node="+node);

	if (node.indexOf("_meta") != -1) {

	} else if (node.indexOf("_data") != -1) {
		var nodeName = node.substring(0, node.indexOf("_"));
		var updatedTransducers = new Array();
		var transducerValues = $(entry).find("transducerValue");
		for (var i = 0; i < transducerValues.length; i++) {
			var data = SensorData.fromXMLString(transducerValues.eq(i));
			if (!data) {
				/* Transducerに値が入っていないとき、上の関数はnullを返す。ので、それの処理を飛ばす */
				continue;
			}
			var transducer = this.subscribedDevices[nodeName].getTransducer(data.id);
			if (!transducer) {
				console.log("[SoxClient.js] SoxClient::_processPublishedItem: no transducer foudn for " + data.toString());
				continue;
			} else if (transducer.setSensorData(data)) {
				updatedTransducers.push(transducer);
			}
			console.log("[SoxClient.js] SoxClient::_processPublishedItem: Received " + data.toString());
		}
		if (this.soxEventListener && updatedTransducers.length != 0) {
			this.soxEventListener.sensorDataReceived({
				soxClient : this,
				device : this.subscribedDevices[nodeName],
				transducers : updatedTransducers
			});
		}
	}
	return true;
};

function printStackTrace(e) {
	if (e.stack) {
		console.log(e.stack);
	} else {
		console.log(e.message, e);
	}
}

function SoxEventListener() {}

/**
 * Called when the device, to which this listener is registered, receives a new sensor data.
 *
 * @param soxEvent { soxClient: SoxClient instance, device: Device instance, transducers: Transducer instances}
 */
SoxEventListener.prototype.sensorDataReceived = function(soxEvent) {};

/**
 * Called when the device, to which this listener is registered, receives a new meta data.
 *
 * @param soxEvent { soxClient: SoxClient instance, device: Device instance }
 */
SoxEventListener.prototype.metaDataReceived = function(soxEvent) {};

/**
 * Called when the device, to which this listener is registered, has successfully established
 * a connection to the server
 * @param soxEvent {soxClient: SoxClient instance}
 */
SoxEventListener.prototype.connected = function(soxEvent){};

/**
 * Called when the connection request to the device, to which this listener is registered,
 * has failed.
 * @param soxEvent {soxClient: SoxClient instance, errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.connectionFailed = function(soxEvent){};

/**
 * Called when the program has disconnected from the device
 * @param soxEvent {soxClient: SoxClient instance}
 */
SoxEventListener.prototype.disconnected = function(soxEvent){};

/**
 * Called when a node creation request has been processed by the server successfully
 * @param soxEvent {soxClient: SoxClient instance, device: device}
 */
SoxEventListener.prototype.created = function(soxEvent){};

/**
 * Called when a node creation request has been failed by the server
 * @param soxEvent {soxClient: SoxClient instance, device: device, nodeName: "name", errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.creationFailed = function(soxEvent){};

/**
 * Called when node discovery request has been processed by the server successfully
 * @param soxEvent {soxClient: SoxClient instance, devices: device array}
 */
SoxEventListener.prototype.discovered = function(soxEvent){};

/**
 * Called when node discovery request has been failed
 * @param soxEvent {soxClient: SoxClient instance, errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.discoveryFailed = function(soxEvent){};

/**
 * Called when node resolve request has been processed by the server successfully
 * @param soxEvent {soxClient: SoxClient instance, device: device}
 */
SoxEventListener.prototype.resolved = function(soxEvent){};

/**
 * Called when node resolve request has been failed
 * @param soxEvent {soxClient: SoxClient instance, device: device, errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.resolveFailed = function(soxEvent){};

/**
 * Called when a node deletion request has been processed by the server successfully
 * @param soxEvent {soxClient: SoxClient instance, device: device}
 */
SoxEventListener.prototype.deleted = function(soxEvent){};

/**
 * Called when a node deletion request has been failed by the server
 * @param soxEvent {soxClient: SoxClient instance, device: device, nodeName: "name", errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.deletionFailed = function(soxEvent){};

/**
 * Called when a subscription request to the device, to which this listener is registered,
 * has successfully processed by the server
 *
 * @param soxEvent {device: Device instance}
 */
SoxEventListener.prototype.subscribed = function(soxEvent){};

/**
 * Called when a publish request has successfully processed by the server
 *
 * @param soxEvent {device: Device instance}
 */
SoxEventListener.prototype.published = function(soxEvent){};

/**
 * Called when a subscription request to the device, to which this listener is registered,
 * has failed.
 *
 * @param soxEvent {device: Device instance, nodeName: "name", errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.subscriptionFailed = function(soxEvent){};

/**
 * Called when the unsubscription request to the device, to which this listener is registered,
 * has successfully processed by the server
 *
 * @param soxEvent {device: Device instance, nodeName: "name"}
 */
SoxEventListener.prototype.unsubscribed = function(soxEvent){};

/**
 * Called when the unsubscription request to the device, to which this listener is registered,
 * has failed.
 *
 * @param soxEvent {device: Device instance, nodeName: "name", errorCode: errorCode(http://xmpp.org/extensions/xep-0086.html)}
 */
SoxEventListener.prototype.unsubscriptionFailed = function(soxEvent){};

/**
 * BOSHサービス(HTTP-XMPPブリッジ)のURLとXMPPサーバホスト名、ノード名を
 * 指定して、デバイスを作成する。ノード名には_dataや_metaを除いた部分を 指定する。
 * とる引数の数によって挙動が異なる。
 * 引数が2つの場合:
 *      nodeNameとclientを引数にとり、デバイスが生成された時にDeviceを解決しに行く
 * その他:
 *      各情報を手動で設定
 */
function Device(arg1, arg2, arg3, arg4, arg5, arg6) {
     switch (arguments.length) {
          case 2:
              /**
               * @param arg1 (nodeName) XMPP node name of this device. required
               * @param arg2 (client) connected sox client.
               */
              this.initWithClient(arg1, arg2);
              break;
          default:
              /**
                * @param arg1 (nodeName) XMPP node name of this device. required
                * @param arg2 (name) name of this device. ignored for remote device
                * @param arg3 (type) type of this device. ignored for remote device
                * @param arg4 (accessModel) access model of this device. value must be one of open, authorize, whitelist, presence, and roster. ignored for remote device
                * @param arg5 (publishModel) publish model of this device. value must be one of open, publishers, or subscribers. ignored for remote device
                * @param arg6 (transducers) array of transducers of this device. ignored for remote device 
               */
              this.init(arg1, arg2, arg3, arg4, arg5, arg6);
              break;
     }
}

Device.prototype.init = function (nodeName, name, type, accessModel, publishModel, transducers) {
	/**
	 * profiles of this device included in SoX specification
	 */
	this.nodeName = nodeName;
	this.name = name;
	this.type = type;
	this.accessModel = accessModel;
	this.publishModel = publishModel;

	/**
	 * runtime information that won't be included in meta data
	 */
	if(transducers){
		this.transducers = $.extend(true, {}, transducers);
	}else{
		this.transducers = new Array(); // array of transducers
	}
	this.soxEventListener = null;

	this.dataSubid = "";
	this.metaSubid = "";
	this.dataSubscribed = false;
	this.metaSubscribed = false;
};

Device.prototype.initWithClient = function (nodeName, client) {
    if (client.isConnected()){
    	/**
    	 * profiles of this device included in SoX specification
    	 */
    	this.nodeName = nodeName;
        this.client = client;
    	this.name = undefined;
    	this.type = undefined;
    	this.accessModel = undefined;
    	this.publishModel = undefined;
    
    	/**
    	 * runtime information that won't be included in meta data
    	 */
    	this.transducers = new Array(); // array of transducers
    
    	this.soxEventListener = null;
    
    	this.dataSubid = "";
    	this.metaSubid = "";
    	this.dataSubscribed = false;
    	this.metaSubscribed = false;
    
        client.resolveDevice(this);
    } else {
        init(nodeName, client);
    }
};

/**
{
    "device": {
        "name": "東京都の今日の天気",
        "type": "outdoor weather",
        "nodeName": "東京都の今日の天気",
        "transducers": [
            {
                "name": "weather_img",
                "id": "weather_img",
                "units": "png"
            },
            {
                "name": "weather",
                "id": "weather"
            },
            {
                "name": "max_temp",
                "id": "max_temp",
                "units": "celcius"
            },
            {
                "name": "min_temp",
                "id": "min_temp",
                "units": "celcius"
            },
            {
                "name": "latitude",
                "id": "latitude"
            },
            {
                "name": "longitude",
                "id": "longitude"
            }
        ]
    }
}
 * 
 * @param jsonObject
 * @returns {___anonymous1506_1515}
 */
Device.fromJson = function(jsonObject) {
	var device = new Device();
	device.name = jsonObject.device.name;
	device.type = jsonObject.device.type;
	if(jsonObject.device.nodeName){
		device.nodeName = jsonObject.device.nodeName;
	}else{
		device.nodeName = jsonObject.device.name;
	}

	for(var i=0; i < jsonObject.device.transducers.length; i++){
		var transducer = Transducer.fromJson(jsonObject.device.transducers[i]);
		if (device.getTransducer(transducer.id)) {
			continue;
		}
		device.transducers.push(transducer);
		//console.log("Created " + transducer.toString());
	}

	return device;
};

/**
 *  <ANYTAG>
 *		<device name='SSLabMote' type='indoor weather'>
 *			<transducer 	name="temperature" 
 *							id="temp" canActuate="false" 
 *							units="kelvin" 
 *							unitScalar="0" 
 *							minValue="270" 
 *							maxValue="320" 
 *							resolution="0.1">
 *			</transducer>
 *			<transducer 	name="humidity" 
 *							id="humid" 
 *							canActuate="false" 
 *							units="percent" 
 *							unitScalar="0" 
 *							minValue="0" 
 *							maxValue="100" 
 *							resolution="0.1">
 *			</transducer>
 *		</device>
 *	</ANYTAG>
 * @param jQueryObject
 * @returns device instance
 */
Device.fromXML = function(jQueryObject){
	var deviceElement = $(jQueryObject).find('device');
	var device = new Device();
	device.name = $(deviceElement).attr('name');
	device.type = $(deviceElement).attr('type');

	var transducerElements = $(deviceElement).find("transducer");
	for (var i = 0; i < transducerElements.length; i++) {
		var transducer = Transducer.fromXML(transducerElements.eq(i));
		if (device.getTransducer(transducer.id)) {
			continue;
		}
		device.transducers.push(transducer);
		//console.log("Created " + transducer.toString());
	}

	return device;
};

Device.prototype.toString = function() {
	var deviceString = "Device[nodeName="+this.nodeName+", name="+this.name+", type="+this.type+", accessModel="+this.accessModel+", publishModel="+this.publishModel+", transducers=";
	var transducerString = "[";
	if(this.transducers){
		this.transducers.forEach(function(transducer){
			transducerString += transducer.toString();
		});
	}
	transducerString += "]";
	return deviceString+transducerString;
};

/**
 * 	{	"name": "藤沢市役所大気汚染常時監視センサ",
 * 		"type": "outdoor weather",
 * 		"nodeName": "sample", //optional
 * 		"transducers": [
 * 			{	"name": "二酸化硫黄(SO2)"
 * 				"id": "so2",
 * 				"canActuate": false,
 * 				"units": "ppm",
 * 				"unitScalar": 0,
 * 				"minValue": 0,
 * 				"maxValue": 10;
 * 				"resolution": 0.001,
 * 				"value": {
 * 					"path":"html:/html/body/table/tbody/tr[3]/td[1]/font[0]",
 * 				}
 * 			},{	"name": "二酸化窒素(NO2)"
 * 				"id": "no2",
 * 				"canActuate": false,
 * 				"units": "ppm",
 * 				"unitScalar": 0,
 * 				"minValue": 0,
 * 				"maxValue": 10;
 * 				"resolution": 0.001,
 * 				"value": {
 * 					"url": "http://www.k-erc.pref.kanagawa.jp/taiki/fujisawak.asp",
 * 					"path":"html:/html/body/table/tbody/tr[3]/td[2]/font[0]",
 * 					"update": "15 * * * *" //crontab記法でアップデート時刻を表記
 * 				}
 * 			}
 * 		]
 * 	}
 * 
 * @param jsonObject
 * @returns {___anonymous1506_1515}
 */
Device.prototype.toJsonString = function(){
	var jsonString = '{' 
	+ (this.name? '"name":"'+this.name+'",\n' : "")
	+ (this.type? '"type":"'+this.type+'",\n' : "")
	+ (this.nodeName? '"nodeName":"'+this.nodeName+'",\n' : "")
	+ '"transducers": [\n';
	
	for(var i=0; i < this.transducers.length; i++){
		var transducerJsonString = this.transducers[i].toJsonString();
		jsonString += transducerJsonString;
		if(i < this.transducers.length-1){
			jsonString += ',';
		}
		jsonString += '\n';
	}
	jsonString += ']\n'; //end of transducers
	jsonString += '}';   //end of device
	return jsonString;
};

/**
 * Generate a metainfo xml string
 * 
 * <transducer name='temperature' id='temp' canActuate='false' units='kelvin' unitScalar='0' minValue='270' maxValue='320' resolution='0.1'>
 * </transducer>
 * <transducer name='humidity' id='humid' canActuate='false' units='percent' unitScalar='0' minValue='0' maxValue='100' resolution='0.1'>
 * </transducer>
 */
Device.prototype.toMetaString = function(){
	var metaString = "";
	for(var i=0; i < this.transducers.length; i++){
		metaString += (this.transducers[i].toMetaString()+"\n");
	}
	
	return metaString;
};

Device.prototype.toDataString = function(){
	var dataString = "";

	for(var i=0; i < this.transducers.length; i++){
		var data = this.transducers[i].getSensorData();
		if(data){
			dataString += (data.toXMLString()+"\n");
		}
	}
	
	return dataString;
};

/**
 * Checks if any transducer has unpublished sensor value
 */
Device.prototype.isDataDirty = function(){
	for(var i=0; i < this.transducers.length; i++){
		if(this.transducers[i].isDataDirty){
			return true;
		}
	}
	
	return false;
};

Device.prototype.setDataDirty = function(flag){
	for(var i=0; i < this.transducers.length; i++){
		this.transducers[i].isDataDirty = flag;
	}	
};

/**
 * Checks if any transducer has unpublished sensor value
 */
Device.prototype.isMetaDirty = function(){
	for(var i=0; i < this.transducers.length; i++){
		if(this.transducers[i].isMetaDirty){
			return true;
		}
	}
	
	return false;
};

Device.prototype.setMetaDirty = function(flag){
	for(var i=0; i < this.transducers.length; i++){
		this.transducers[i].isMetaDirty = flag;
	}	
};


/**
 * Returns the name of this device
 */
Device.prototype.getName = function() {
	return this.name;
};

/**
 * Returns the type of this device
 */
Device.prototype.getType = function() {
	return this.type;
};

Device.prototype.addTransducer = function(transducer){
	this.transducers.push(transducer);
};

/**
 * Returns transducer instance with specified id
 */
Device.prototype.getTransducer = function(id){
	for(var i=0; i < this.transducers.length; i++){
		if(this.transducers[i].id == id){
			return this.transducers[i];
		}
	}

	return null;
};

/**
 * Returns transducer instance with specified id
 */
Device.prototype.hasTransducer = function(id){
	for(var i=0; i < this.transducers.length; i++){
		if(this.transducers[i].id == id){
			return true;
		}
	}

	return false;
};

Device.prototype.getTransducerAt = function(index){
	if(index >= this.getTransducerCount()){
		return null;
	}
	return this.transducers[index];
};

Device.prototype.getTransducerCount = function(){
	return this.transducers.length;
};

/**
 * Registers a listener object to this device.
 * 
 * @param soxEventListener
 *            SoxEventListener instance
 */
Device.prototype.setSoxEventListener = function(soxEventListener) {
	this.soxEventListener = soxEventListener;
};
/**
 * 以下のようなXMLノードのjQueryオブジェクトを引数に、transducer(センサまたは アクチュエータ)のインスタンスを作成する。
 *
 * <transducer name='current temperature' id='temp' canActuate='false'
 * hasOwnNode='false' units='kelvin' unitScalar='0' minValue='270'
 * maxValue='320' resolution='0.1'> </transducer>
 */

function Transducer() {
	this.name = undefined;
	this.id = undefined;
	this.units = undefined;
	this.unitScaler = undefined;
	this.canActuate = undefined;
	this.hasOwnNode = undefined;
	this.typeName = undefined;
	this.manufacturer = undefined;
	this.partNumber = undefined;
	this.serialNumber = undefined;
	this.minValue = undefined;
	this.maxValue = undefined;
	this.resolution = undefined;
	this.precision = undefined;
	this.accuracy = undefined;
	this.sensorData = undefined;
	this.isDataDirty = false;
}

/**
 * {	"name": "二酸化窒素(NO2)"
 * 				"id": "no2",
 * 				"canActuate": false,
 * 				"units": "ppm",
 * 				"unitScalar": 0,
 * 				"minValue": 0,
 * 				"maxValue": 10;
 * 				"resolution": 0.001,
 * 				"value": {
 * 					"url": "http://www.k-erc.pref.kanagawa.jp/taiki/fujisawak.asp",
 * 					"path":"html:/html/body/table/tbody/tr[3]/td[2]/font[0]",
 * 					"update": "15 * * * *" //crontab記法でアップデート時刻を表記
 * 				}
 * 			}
 * @param jsonObject
 * @returns {___anonymous838_847}
 */
Transducer.fromJson = function(jsonObject) {
	var transducer = new Transducer();
	if (jsonObject) {
		transducer.name = jsonObject.name;
		transducer.id = jsonObject.id;
		transducer.units = jsonObject.units;
		transducer.unitScaler = parseInt(jsonObject.unitScaler);
		transducer.canActuate = jsonObject.canActuate;
		transducer.hasOwnNode = jsonObject.hasOwnNode;
		transducer.typeName = jsonObject.typedName;
		transducer.manufacturer = jsonObject.manufacturer;
		transducer.partNumber = jsonObject.partNumber;
		transducer.serialNumber = jsonObject.serialNumber;
		transducer.minValue = jsonObject.minValue;
		transducer.maxValue = jsonObject.maxValue;
		transducer.resolution = jsonObject.resolution;
		transducer.precision = jsonObject.precision;
		transducer.accuracy = jsonObject.accuracy;
	}
	return transducer;
};

Transducer.fromXML = function(jQueryObject){
	var transducer = new Transducer();
	if (jQueryObject) {
		transducer.name = jQueryObject.attr("name");
		transducer.id = jQueryObject.attr("id");
		transducer.units = jQueryObject.attr("units");
		transducer.unitScaler = parseInt(jQueryObject.attr("unitScaler"));
		transducer.canActuate = jQueryObject.attr("canActuate") == "true";
		transducer.hasOwnNode = jQueryObject.attr("hasOwnNode") == "true";
		transducer.typeName = jQueryObject.attr("transducerTypeName");
		transducer.manufacturer = jQueryObject.attr("manufacturer");
		transducer.partNumber = jQueryObject.attr("partNumber");
		transducer.serialNumber = jQueryObject.attr("serialNumber");
		transducer.minValue = parseFloat(jQueryObject.attr("minValue"));
		transducer.maxValue = parseFloat(jQueryObject.attr("maxValue"));
		transducer.resolution = parseFloat(jQueryObject.attr("resolution"));
		transducer.precision = parseFloat(jQueryObject.attr("precision"));
		transducer.accuracy = parseFloat(jQueryObject.attr("accuracy"));
	}
	return transducer;
};

/**
 * Sets current data of this transducer.
 * If the specified data has the timestamp equal to or older than
 * the currently saved data, it's ignored.
 *
 * @return true if data is updated with the specified one.
 */
Transducer.prototype.setSensorData = function(sensorData){
	if(this.sensorData && sensorData.timestamp <= this.sensorData.timestamp){
		return false;
	}

	this.sensorData = sensorData;
	this.isDataDirty = true;
	return true;
};

Transducer.prototype.getSensorData = function(){
	return this.sensorData;
};

Transducer.prototype.toString = function() {
	var transducerString =  "Transducer[name=" + this.name + ", id=" + this.id ;
	var parameters = ["units", "unitScaler", "canActuate", "hasOwnNode", "typeName", "manufacturer", "partNumber", "serialNumber", "minValue", "maxValue", "resolution", "precision", "accuracy"];
	parameters.forEach(function(param){
		if(this[param]){
			transducerString += ", "+param+"="+this[param];
		}
	});

	if(this.sensorData){
		transducerString += ", sensorData="+this.sensorData.toString();
	}

	transducerString += "]";

	return transducerString;
/*
return "[Transducer name=" + this.name + ", id=" + this.id +
		(this.units ? ", units="+this.units : "")+
		(this.unitScaler ? ", unitScaler="+this.unitScaler : "")+

		+ this.units + ", unitScaler=" + this.unitScaler + ", canActuate="
			+ this.canActuate + ", hasOwnNode=" + this.hasOwnNode
			+ ", typeName=" + this.typeName + ", manufacturer="
			+ this.manufacturer + ", partNumber=" + this.partNumber
			+ ", serialNumber=" + this.serialNumber + ", minValue="
			+ this.minValue + ", maxValue=" + this.maxValue + ", resolution="
			+ this.resolution + ", precision=" + this.resolution
			+ ", precision=" + this.precision + ", accuracy=" + this.accuracy;
			+ (this.sensorData ? ", sensorData="+this.sensorData.toValueString() : "")
			+ "]";
			*/
};

/**
 * 			{	"name": "二酸化硫黄(SO2)"
 * 				"id": "so2",
 * 				"canActuate": false,
 * 				"units": "ppm",
 * 				"unitScalar": 0,
 * 				"minValue": 0,
 * 				"maxValue": 10;
 * 				"resolution": 0.001,
 * 				"value": {
 * 					"path":"html:/html/body/table/tbody/tr[3]/td[1]/font[0]",
 * 				}
 * 			}
 */
Transducer.prototype.toJsonString = function(){
	return '{'
	+ (this.name? '"name":"'+this.name+'"' : "")
	+ (this.id? ',\n'+'"id":"'+this.id+'"' : "")
	+ (this.units? ',\n'+'"units":"'+this.units+'"' : "")
	+ (this.unitScaler? ',\n'+'"unitScaler":"'+this.unitScaler+'"' : "")
	+ (this.canActuate? ',\n'+'"canActuate":"'+this.canActuate+'"' : "")
	+ (this.hasOwnNode? ',\n'+'"hasOwnNode":"'+this.hasOwnNode+'"' : "")
	+ (this.typeName? ',\n'+'"typeName":"'+this.typeName+'"' : "")
	+ (this.manufacturer? ',\n'+'"manufacturer":"'+this.manufacturer+'"' : "")
	+ (this.partNumber? ',\n'+'"partNumber":"'+this.partNumber+'"' : "")
	+ (this.serialNumber? ',\n'+'"serialNumber":"'+this.serialNumber+'"' : "")
	+ (this.minValue? ',\n'+'"minValue":"'+this.minValue+'"' : "")
	+ (this.maxValue? ',\n'+'"maxValue":"'+this.maxValue+'"' : "")
	+ (this.resolution? ',\n'+'"resolution":"'+this.resolution+'"' : "")
	+ (this.precision? ',\n'+'"precision":"'+this.precision+'"' : "")
	+ (this.accuracy? ',\n'+'"accuracy":"'+this.accuracy+'"' : "")
	+ '}';
};

/**
 * Generate a metainfo xml string
 *
 * <transducer name='temperature' id='temp' canActuate='false' units='kelvin' unitScalar='0' minValue='270' maxValue='320' resolution='0.1'>
 * </transducer>
 */
Transducer.prototype.toMetaString = function(){
	return "<transducer " +
	(this.name ? "name='"+this.name+"' " : "") +
	(this.id ? "id='"+this.id+"' " : "") +
	(this.units ? "units='"+this.units+"' " : "") +
	(this.unitScaler ? "unitScaler='"+this.unitScaler+"' " : "") +
	(this.canActuate ? "canActuate='"+this.canActuate+"' " : "") +
	(this.hasOwnNode ? "hasOwnNode='"+this.hasOwnNode+"' " : "") +
	(this.typeName ? "typeName='"+this.typeName+"' " : "") +
	(this.manufacturer ? "manufacturer='"+this.manufacturer+"' " : "") +
	(this.partNumber ? "partNumber='"+this.partNumber+"' " : "") +
	(this.serialNumber ? "serialNumber='"+this.serialNumber+"' " : "") +
	(this.minValue ? "minValue='"+this.minValue+"' " : "") +
	(this.maxValue ? "maxValue='"+this.maxValue+"' " : "") +
	(this.resolution ? "resolution='"+this.resolution+"' " : "") +
	(this.precision ? "precision='"+this.precision+"' " : "") +
	(this.accuracy ? "accuracy='"+this.accuracy+"' " : "") +
	"/>";
};

Transducer.prototype.toDataString = function(){
	if(this.sensorData){
		return this.sensorData.toXMLString();
	}else{
		return null;
	}
};

/**
 * A human friendly identifier to distinguish between various possible
 * transducers within a device
 */
Transducer.prototype.getName = function() {
	return this.name;
};

/**
 * A unique identifier for the transducer used within the XML packet to
 * enumerate different transducers within a single packet The tuple (UUID X,
 * transducer id Y) MUST be unique such that a publish operation to a data value
 * node X_data with the transducer id Y unambiguously refers to one and only one
 * transducer.
 */
Transducer.prototype.getId = function() {
	return this.id;
};

/**
 * Unit of measure (see below)
 */
Transducer.prototype.getUnits = function() {
	return this.units;
};

/**
 * The scale of the unit as a power of 10 (i.e. n for 10 ** n)
 */
Transducer.prototype.getUnitScaler = function() {
	return this.unitScaler;
};

/**
 * Indicates whether the transducer can be actuated
 */
Transducer.prototype.isActuator = function() {
	return this.canActuate;
};

/**
 * Indicates whether the transducer data has its own node or whether it is part
 * of the generic data value node
 */
Transducer.prototype.hasOwnNode = function() {
	return this.hasOwnNode;
};

/**
 * A human readable indication of the type of transducer
 */
Transducer.prototype.getTypeName = function() {
	return this.typeName;
};

/**
 * Manufacturer of the transducer
 */
Transducer.prototype.getManufacturer = function() {
	return this.manufacturer;
};
;

/**
 * Manufacturer's part number of the transducer
 */
Transducer.prototype.getPartNumber = function() {
	return this.partNumber;
};

/**
 * Manufacturer's serial number of the transducer
 */
Transducer.prototype.getSerialNumber = function() {
	return this.serialNumber;
};

/**
 * The expected minimum value for this transducer
 */
Transducer.prototype.getMinValue = function() {
	return this.minValue;
};

/**
 * The expected maximum value for this transducer
 */
Transducer.prototype.getMaxValue = function() {
	return this.maxValue;
};

/**
 * The resolution of the values reported by this transducer
 */
Transducer.prototype.getResolution = function() {
	return this.resolution;
};

/**
 * The accuracy of the values reported by this transducer
 */
Transducer.prototype.getAccuracy = function() {
	return this.accuracy;
};

/**
 * The precision of the values reported by this transducer
 */
Transducer.prototype.getPrecision = function() {
	return this.precision;
};

/**

以下のようなXMLノードのjQueryオブジェクトを引数に、センサデータのインスタンスを作成する

<transducerValue rawvalue='52' timestamp='2014-01-08T18:54:21.485+09:00' typedvalue='52' id='unko'/>

**/

function SensorData(id, timestamp, rawValue, typedValue){
    this.rawValue = rawValue;
    this.typedValue = typedValue;
    this.id = id;
    this.timestamp = timestamp;
}

SensorData.prototype.getId = function(){
    return this.id;
};

/**
 * 単位変換前の生データを返す
 **/
SensorData.prototype.getRawValue = function(){
    return this.rawValue;
};

/**
 * センサデータ生成時刻を表すDateオブジェクトを返す
 **/
SensorData.prototype.getTimestamp = function(){
    return this.timestamp;
};

/**
 * 単位変換後のデータを返す
 **/
SensorData.prototype.getTypedValue = function(){
    return this.typedValue;
};

SensorData.fromXMLString = function(xml){
    var jQueryObject = xml;
    var rawValue = jQueryObject.attr("rawvalue");
    var typedValue = jQueryObject.attr("typedvalue");
    var id = jQueryObject.attr("id");

    var timeParser = /(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+).(\d+)\+(\d+)/;
    //var timeParserForSensorizer = /(\d+)-(\d+)-(\d+)T(\d+):(\d+)([A-Z]+)\+(\d+)/;
    var timeParserForSensorizer = /(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)\+(\d+):(\d+)/;
    var timeReg = timeParser.exec(jQueryObject.attr("timestamp"));
    var timeRegForSensorizer = timeParserForSensorizer.exec(jQueryObject.attr("timestamp"));
    if(!timeReg && !timeRegForSensorizer){
        //console.log("####### timeReg is null (id="+id+" timestamp="+jQueryObject.attr("timestamp")+")");
        var timestamp = jQueryObject.attr("timestamp");
        return new SensorData(id, timestamp, rawValue, typedValue);
    }else{
        if(!timeReg){
            timeReg = timeRegForSensorizer;
        }
        var timestamp = new Date(timeReg[1], parseInt(timeReg[2])-1, timeReg[3], timeReg[4], timeReg[5], timeReg[6]);

        return new SensorData(id, timestamp, rawValue, typedValue);
    }
};

SensorData.prototype.toXMLString = function(){
	var offset = this.timestamp.getTimezoneOffset() / 60;
	var ts = this.timestamp.getFullYear()+"-"+
			(this.timestamp.getMonth()+1)+"-"+
			this.timestamp.getDate()+"T"+
			this.timestamp.getHours()+":"+
			this.timestamp.getMinutes()+":"+
			this.timestamp.getSeconds()+"."+
			("00"+this.timestamp.getMilliseconds()).slice(-3)+
			(offset < 0 ? "-" : "+")+offset+":00";

	return "<transducerValue rawValue='"+this.rawValue+"' "+
		"typedValue='"+this.typedValue+"' "+
		"timestamp='"+ts+"' "+
		"id='"+this.id+"'/>";
};

/**
 * このセンサデータの文字列表現を返す
 **/
SensorData.prototype.toString = function(){
    return "SensorData[rawValue="+this.rawValue+", typedValue="+this.typedValue+", timestamp="+this.timestamp.toString()+", id="+this.id+"]";
};
module.exports = {
	SoxClient : SoxClient,
	Device : Device,
	SensorData: SensorData,
	SoxEventListener: SoxEventListener,
	Transducer: Transducer
}