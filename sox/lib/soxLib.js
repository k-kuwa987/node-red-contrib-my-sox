var events = require('events');
var jsdom = require('jsdom').jsdom;
var document = jsdom('<html></html>', {});
var window = document.defaultView;
var $ = require('jquery-lite')(window);

var strophe = require("node-strophe").Strophe;
var Strophe = strophe.Strophe;
var Backbone = require("backbone");
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

		factory($, _, Backbone, Strophe);

	}(this, function($, _, Backbone, Strophe) {

		// Add the **PubSub** plugin to Strophe
		Strophe.addConnectionPlugin('PubSub', {

			_connection : null,
			service : null,
			events : {},
			// eventEmitter : new events.EventEmitter(),
			// trigger: function(topic, payload){
			// 	eventEmitter.emit(topic, payload);
			// },

			// **init** adds the various namespaces we use and extends the component
			// from **Backbone.Events**.
			init : function(connection) {
				this._connection = connection;
				Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
				Strophe.addNamespace('PUBSUB_EVENT', Strophe.NS.PUBSUB + '#event');
				Strophe.addNamespace('PUBSUB_OWNER', Strophe.NS.PUBSUB + '#owner');
				Strophe.addNamespace('PUBSUB_NODE_CONFIG', Strophe.NS.PUBSUB + '#node_config');
				Strophe.addNamespace('ATOM', 'http://www.w3.org/2005/Atom');
				Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
				Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
				_.extend(this, Backbone.Events);
			},

			// Register to PEP events when connected
			statusChanged : function(status, condition) {
				if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
					this.service = 'pubsub.' + Strophe.getDomainFromJid(this._connection.jid);
					this._connection.addHandler(this._onReceivePEPEvent.bind(this), null, 'message', null, null, this.service);
				}
			},

			// Handle PEP events and trigger own events.
			_onReceivePEPEvent : function(ev) {

				var self = this, delay = $('delay[xmlns="' + Strophe.NS.DELAY + '"]', ev).attr('stamp');

				$('item', ev).each(function(idx, item) {

					var node = $(item).parent().attr('node'), id = $(item).attr('id'), entry = Strophe.serialize($(item)[0]);

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
				});

				// PEP event for the item deleted from a node.
				$('retract', ev).each(function(idx, item) {
					var node = $(item).parent().attr('node'), id = $(item).attr('id');
					self.trigger('xmpp:pubsub:item-deleted', {
						node : node,
						id : id
					});
					self.trigger('xmpp:pubsub:item-deleted:' + node, {
						id : id
					});
				});

				return true;
			},

			// **createNode** creates a PubSub node with id `node` with configuration options defined by `options`.
			// See [http://xmpp.org/extensions/xep-0060.html#owner-create](http://xmpp.org/extensions/xep-0060.html#owner-create)
			createNode : function(node, options) {
				//TODO //new Strophe.Builder("iq", attrs); must be replaced for $iq
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{ //TODO: $iq is not defined sigh....
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('create', {
					node : node
				}), fields = [], option, form;

				if (options) {
					fields.push(new Strophe.x.Field({
						'var' : 'FORM_TYPE',
						type : 'hidden',
						value : Strophe.NS.PUBSUB_NODE_CONFIG
					}));
					_.each(options, function(value, option) {
						fields.push(new Strophe.x.Field({
							'var' : option,
							value : value
						}));
					});
					form = new Strophe.x.Form({
						type : 'submit',
						fields : fields
					});
					iq.up().c('configure').cnode(form.toXML());
				}
				this._connection.sendIQ(iq.tree(), d.resolve, d.reject);
				return d.promise();
			},

			// **deleteNode** deletes the PubSub node with id `node`.
			// See [http://xmpp.org/extensions/xep-0060.html#owner-delete](http://xmpp.org/extensions/xep-0060.html#owner-delete)
			deleteNode : function(node) {
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB_OWNER
				}).c('delete', {
					node : node
				});

				this._connection.sendIQ(iq.tree(), d.resolve, d.reject);
				return d.promise();
			},

			// **getNodeConfig** returns the node's with id `node` configuration options in JSON format.
			// See [http://xmpp.org/extensions/xep-0060.html#owner-configure](http://xmpp.org/extensions/xep-0060.html#owner-configure)
			getNodeConfig : function(node) {
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'get',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB_OWNER
				}).c('configure', {
					node : node
				}), form;
				this._connection.sendIQ(iq.tree(), function(result) {
					form = Strophe.x.Form.fromXML($('x', result));
					d.resolve(form.toJSON().fields);
				}, d.reject);
				return d.promise();
			},

			// **discoverNodes** returns the nodes of a *Collection* node with id `node`.
			// If `node` is not passed, the nodes of the root node on the service are returned instead.
			// See [http://xmpp.org/extensions/xep-0060.html#entity-nodes](http://xmpp.org/extensions/xep-0060.html#entity-nodes)
			discoverNodes : function(node, timeout) {
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'get',
					id : this._connection.getUniqueId('pubsub')
				});

				if (node) {
					iq.c('query', {
						xmlns : Strophe.NS.DISCO_ITEMS,
						node : node
					});
				} else {
					iq.c('query', {
						xmlns : Strophe.NS.DISCO_ITEMS
					});
				}
				this._connection.sendIQ(iq.tree(), function(result) {
					d.resolve($.map($('item', result), function(item, idx) {
						return $(item).attr('node');
					}));
				}, d.reject, timeout);
				return d.promise();
			},

			// **publish** publishes `item`, an XML tree typically built with **$build** to the node specific by `node`.
			// Optionally, takes `item_id` as the desired id of the item.
			// Resolves on success to the id of the item on the node.
			// See [http://xmpp.org/extensions/xep-0060.html#publisher-publish](http://xmpp.org/extensions/xep-0060.html#publisher-publish)
			publish : function(node, item, item_id) {
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('publish', {
					node : node
				}).c('item', item_id ? {
					id : item_id
				} : {}).cnode(item);
				this._connection.sendIQ(iq.tree(), function(result) {
					d.resolve($('item', result).attr('id'));
				}, d.reject);
				return d.promise();
			},

			// **publishAtom** publishes a JSON object as an ATOM entry.
			publishAtom : function(node, json, item_id) {
				json.updated = json.updated || (this._ISODateString(new Date()));
				return this.publish(node, this._JsonToAtom(json), item_id);
			},

			// **deleteItem** deletes the item with id `item_id` from the node with id `node`.
			// `notify` specifies whether the service should notify all subscribers with a PEP event.
			// See [http://xmpp.org/extensions/xep-0060.html#publisher-delete](http://xmpp.org/extensions/xep-0060.html#publisher-delete)
			deleteItem : function(node, item_id, notify) {
				notify = notify || true;
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('retract', notify ? {
					node : node,
					notify : "true"
				} : {
					node : node
				}).c('item', {
					id : item_id
				});
				this._connection.sendIQ(iq.tree(), d.resolve, d.reject);
				return d.promise();
			},

			// **items** retrieves the items from the node with id `node`.
			// Optionally, you can specify `max_items` to retrieve a maximum number of items,
			// or a list of item ids with `item_ids` in `options` parameters.
			// See [http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve](http://xmpp.org/extensions/xep-0060.html#subscriber-retrieve)
			// Resolves with an array of items.
			// Also if your server supports [Result Set Management](http://xmpp.org/extensions/xep-0059.html)
			// on PubSub nodes, you can pass in options an `rsm` object literal with `before`, `after`, `max` parameters.
			// You cannot specify both `rsm` and `max_items` or `items_ids`.
			// Requesting with `rsm` will resolve with an object literal with `items` providing a list of the items retrieved,
			//and `rsm` with `last`, `first`, `count` properties.

			items : function(node, options) {
				var d = $.Deferred(), iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'get'
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('items', {
					node : node
				});

				options = options || {};

				if (options.rsm) {
					var rsm = $build('set', {
						xmlns : Strophe.NS.RSM
					});
					_.each(options.rsm, function(val, key) {
						rsm.c(key, {}, val);
					});
					iq.up();
					iq.cnode(rsm.tree());
				} else if (options.max_items) {
					iq.attrs({
						max_items : options.max_items
					});
				} else if (options.item_ids) {
					_.each(options.item_ids, function(id) {
						iq.c('item', {
							id : id
						}).up();
					});
				}

				this._connection.sendIQ(iq.tree(), function(res) {
					var items = _.map($('item', res), function(item) {
						return item.cloneNode(true);
					});

					if (options.rsm && $('set', res).length) {
						d.resolve({
							items : items,
							rsm : {
								count : parseInt($('set > count', res).text(), 10),
								first : $('set >first', res).text(),
								last : $('set > last', res).text()
							}
						});
					} else {
						d.resolve(items);
					}

				}, d.reject);
				return d.promise();
			},

			// **subscribe** subscribes the user's bare JID to the node with id `node`.
			// See [http://xmpp.org/extensions/xep-0060.html#subscriber-subscribe](http://xmpp.org/extensions/xep-0060.html#subscriber-subscribe)
			subscribe : function(node) {
				var d = $.Deferred();
				var iq = new Strophe.Builder("iq",{
					from : this._connection.jid,
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('subscribe', {
					node : node,
					jid : this._connection.jid
				});
				this._connection.sendIQ(iq, d.resolve, d.reject);
				return d.promise();
			},

			// **unsubscribe** unsubscribes the user's bare JID from the node with id `node`. If managing multiple
			// subscriptions it is possible to optionally specify the `subid`.
			// See [http://xmpp.org/extensions/xep-0060.html#subscriber-unsubscribe](http://xmpp.org/extensions/xep-0060.html#subscriber-unsubscribe)
			unsubscribe : function(node, jid, subid) {
				var _jid = jid ? jid : Strophe.getBareJidFromJid(this._connection.jid);
				var d = $.Deferred();
				var iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'set',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('unsubscribe', {
					node : node,
					jid : _jid
				});
				if (subid)
					iq.attrs({
						subid : subid
					});
				this._connection.sendIQ(iq, d.resolve, d.reject);
				return d.promise();
			},

			// **getSubscriptions** retrieves the subscriptions of the user's bare JID to the service.
			// See [http://xmpp.org/extensions/xep-0060.html#entity-subscriptions](http://xmpp.org/extensions/xep-0060.html#entity-subscriptions)
			getSubscriptions : function() {
				var d = $.Deferred();
				var iq = new Strophe.Builder("iq",{
					to : this.service,
					type : 'get',
					id : this._connection.getUniqueId('pubsub')
				}).c('pubsub', {
					xmlns : Strophe.NS.PUBSUB
				}).c('subscriptions'), $item;

				this._connection.sendIQ(iq.tree(), function(res) {
					d.resolve(_.map($('subscription', res), function(item) {
						$item = $(item);
						return {
							node : $item.attr('node'),
							jid : $item.attr('jid'),
							subid : $item.attr('subid'),
							subscription : $item.attr('subscription')
						};
					}));
				}, d.reject);
				return d.promise();
			},

			// Private utility functions

			// **_ISODateString** converts a date to an ISO-formatted string.
			_ISODateString : function(d) {
				function pad(n) {
					return n < 10 ? '0' + n : n;
				}

				return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + 'Z';
			},

			// **_JsonToAtom** produces an atom-format XML tree from a JSON object.
			_JsonToAtom : function(obj, tag) {
				var builder;

				if (!tag) {
					builder = $build('entry', {
						xmlns : Strophe.NS.ATOM
					});
				} else {
					builder = $build(tag);
				}
				_.each(obj, function(value, key) {
					if ( typeof value === 'string') {
						builder.c(key, {}, value);
					} else if ( typeof value === 'number') {
						builder.c(key, {}, value.toString());
					} else if ( typeof value === 'boolean') {
						builder.c(key, {}, value.toString());
					} else if ( typeof value === 'object' && 'toUTCString' in value) {
						builder.c(key, {}, this._ISODateString(value));
					} else if ( typeof value === 'object') {
						builder.cnode(this._JsonToAtom(value, key)).up();
					} else {
						this.c(key).up();
					}
				}, this);
				return builder.tree();
			},

			// **_AtomToJson** produces a JSON object from an atom-formatted XML tree.
			_AtomToJson : function(xml) {
				var json = {}, self = this, jqEl, val;

				$(xml).children().each(function(idx, el) {
					jqEl = $(el);
					if (jqEl.children().length === 0) {
						val = jqEl.text();
						if ($.isNumeric(val)) {
							val = Number(val);
						}
						json[el.nodeName.toLowerCase()] = val;
					} else {
						json[el.nodeName.toLowerCase()] = self._AtomToJson(el);
					}
				});
				return json;
			}
		});
	}));

// Generated by CoffeeScript 1.3.3
var $field, $form, $item, $opt, Field, Form, Item, Option, helper,
  __slice = [].slice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

helper = {
  fill: function(src, target, klass) {
    var f, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = src.length; _i < _len; _i++) {
      f = src[_i];
      _results.push(target.push(f instanceof klass ? f : new klass(f)));
    }
    return _results;
  },
  createHtmlFieldCouple: function(f) {
    var div, id;
    div = $("<div>");
    id = "Strophe.x.Field-" + f.type + "-" + f["var"];
    div.append("<label for='" + id + "'>" + (f.label || '') + "</label>").append($(f.toHTML()).attr("id", id)).append("<br />");
    return div.children();
  },
  getHtmlFields: function(html) {
    html = $(html);
    return __slice.call(html.find("input")).concat(__slice.call(html.find("select")), __slice.call(html.find("textarea")));
  }
};

Form = (function() {

  Form._types = ["form", "submit", "cancel", "result"];

  function Form(opt) {
    this.toHTML = __bind(this.toHTML, this);

    this.toJSON = __bind(this.toJSON, this);

    this.toXML = __bind(this.toXML, this);

    var f, i, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3;
    this.fields = [];
    this.items = [];
    this.reported = [];
    if (opt) {
      if (_ref = opt.type, __indexOf.call(Form._types, _ref) >= 0) {
        this.type = opt.type;
      }
      this.title = opt.title;
      this.instructions = opt.instructions;
      helper.fill = function(src, target, klass) {
        var f, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = src.length; _i < _len; _i++) {
          f = src[_i];
          _results.push(target.push(f instanceof klass ? f : new klass(f)));
        }
        return _results;
      };
      if (opt.fields) {
        if (opt.fields) {
          helper.fill(opt.fields, this.fields, Field);
        }
      } else if (opt.items) {
        if (opt.items) {
          helper.fill(opt.items, this.items, Item);
        }
        _ref1 = this.items;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          i = _ref1[_i];
          _ref2 = i.fields;
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            f = _ref2[_j];
            if (!(_ref3 = f["var"], __indexOf.call(this.reported, _ref3) >= 0)) {
              this.reported.push(f["var"]);
            }
          }
        }
      }
    }
  }

  Form.prototype.type = "form";

  Form.prototype.title = null;

  Form.prototype.instructions = null;

  Form.prototype.toXML = function() {
    var f, i, r, xml, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    xml = $build("x", {
      xmlns: "jabber:x:data",
      type: this.type
    });
    if (this.title) {
      xml.c("title").t(this.title.toString()).up();
    }
    if (this.instructions) {
      xml.c("instructions").t(this.instructions.toString()).up();
    }
    if (this.fields.length > 0) {
      _ref = this.fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        xml.cnode(f.toXML()).up();
      }
    } else if (this.items.length > 0) {
      xml.c("reported");
      _ref1 = this.reported;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        r = _ref1[_j];
        xml.c("field", {
          "var": r
        }).up();
      }
      xml.up();
      _ref2 = this.items;
      for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
        i = _ref2[_k];
        xml.cnode(i.toXML()).up();
      }
    }
    return xml.tree();
  };

  Form.prototype.toJSON = function() {
    var f, i, json, _i, _j, _len, _len1, _ref, _ref1;
    json = {
      type: this.type
    };
    if (this.title) {
      json.title = this.title;
    }
    if (this.instructions) {
      json.instructions = this.instructions;
    }
    if (this.fields.length > 0) {
      json.fields = [];
      _ref = this.fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        json.fields.push(f.toJSON());
      }
    } else if (this.items.length > 0) {
      json.items = [];
      json.reported = this.reported;
      _ref1 = this.items;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        i = _ref1[_j];
        json.items.push(i.toJSON());
      }
    }
    return json;
  };

  Form.prototype.toHTML = function() {
    var f, form, i, _i, _j, _len, _len1, _ref, _ref1;
    form = $("<form data-type='" + this.type + "'>");
    if (this.title) {
      form.append("<h1>" + this.title + "</h1>");
    }
    if (this.instructions) {
      form.append("<p>" + this.instructions + "</p>");
    }
    if (this.fields.length > 0) {
      _ref = this.fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        (helper.createHtmlFieldCouple(f)).appendTo(form);
      }
    } else if (this.items.length > 0) {
      _ref1 = this.items;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        i = _ref1[_j];
        ($(i.toHTML())).appendTo(form);
      }
    }
    return form[0];
  };

  Form.fromXML = function(xml) {
    var f, fields, i, instr, items, j, r, reported, title;
    xml = $(xml);
    f = new Form({
      type: xml.attr("type")
    });
    title = xml.find("title");
    if (title.length === 1) {
      f.title = title.text();
    }
    instr = xml.find("instructions");
    if (instr.length === 1) {
      f.instructions = instr.text();
    }
    fields = xml.find("field");
    items = xml.find("item");
    if (items.length > 0) {
      f.items = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = items.length; _i < _len; _i++) {
          i = items[_i];
          _results.push(Item.fromXML(i));
        }
        return _results;
      })();
    } else if (fields.length > 0) {
      f.fields = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = fields.length; _i < _len; _i++) {
          j = fields[_i];
          _results.push(Field.fromXML(j));
        }
        return _results;
      })();
    }
    reported = xml.find("reported");
    if (reported.length === 1) {
      fields = reported.find("field");
      f.reported = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = fields.length; _i < _len; _i++) {
          r = fields[_i];
          _results.push(($(r)).attr("var"));
        }
        return _results;
      })();
    }
    return f;
  };

  Form.fromHTML = function(html) {
    var f, field, fields, i, instructions, item, items, j, title, _i, _j, _len, _len1, _ref, _ref1, _ref2;
    html = $(html);
    f = new Form({
      type: html.attr("data-type")
    });
    title = html.find("h1").text();
    if (title) {
      f.title = title;
    }
    instructions = html.find("p").text();
    if (instructions) {
      f.instructions = instructions;
    }
    items = html.find("fieldset");
    fields = helper.getHtmlFields(html);
    if (items.length > 0) {
      f.items = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = items.length; _i < _len; _i++) {
          i = items[_i];
          _results.push(Item.fromHTML(i));
        }
        return _results;
      })();
      _ref = f.items;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
        _ref1 = item.fields;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          field = _ref1[_j];
          if (!(_ref2 = field["var"], __indexOf.call(f.reported, _ref2) >= 0)) {
            f.reported.push(field["var"]);
          }
        }
      }
    } else if (fields.length > 0) {
      f.fields = (function() {
        var _k, _len2, _results;
        _results = [];
        for (_k = 0, _len2 = fields.length; _k < _len2; _k++) {
          j = fields[_k];
          _results.push(Field.fromHTML(j));
        }
        return _results;
      })();
    }
    return f;
  };

  return Form;

})();

Field = (function() {

  Field._types = ["boolean", "fixed", "hidden", "jid-multi", "jid-single", "list-multi", "list-single", "text-multi", "text-private", "text-single"];

  Field._multiTypes = ["list-multi", "jid-multi", "text-multi", "hidden"];

  function Field(opt) {
    this.toHTML = __bind(this.toHTML, this);

    this.toXML = __bind(this.toXML, this);

    this.toJSON = __bind(this.toJSON, this);

    this.addOptions = __bind(this.addOptions, this);

    this.addOption = __bind(this.addOption, this);

    this.addValues = __bind(this.addValues, this);

    this.addValue = __bind(this.addValue, this);

    var _ref, _ref1;
    this.options = [];
    this.values = [];
    if (opt) {
      if (_ref = opt.type, __indexOf.call(Field._types, _ref) >= 0) {
        this.type = opt.type.toString();
      }
      if (opt.desc) {
        this.desc = opt.desc.toString();
      }
      if (opt.label) {
        this.label = opt.label.toString();
      }
      this["var"] = ((_ref1 = opt["var"]) != null ? _ref1.toString() : void 0) || "_no_var_was_defined_";
      this.required = opt.required === true || opt.required === "true";
      if (opt.options) {
        this.addOptions(opt.options);
      }
      if (opt.value) {
        opt.values = [opt.value];
      }
      if (opt.values) {
        this.addValues(opt.values);
      }
    }
  }

  Field.prototype.type = "text-single";

  Field.prototype.desc = null;

  Field.prototype.label = null;

  Field.prototype["var"] = "_no_var_was_defined_";

  Field.prototype.required = false;

  Field.prototype.addValue = function(val) {
    return this.addValues([val]);
  };

  Field.prototype.addValues = function(vals) {
    var multi, v, _ref;
    multi = (_ref = this.type, __indexOf.call(Field._multiTypes, _ref) >= 0);
    if (multi || (!multi && vals.length === 1)) {
      this.values = __slice.call(this.values).concat(__slice.call((function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = vals.length; _i < _len; _i++) {
            v = vals[_i];
            _results.push(v.toString());
          }
          return _results;
        })()));
    }
    return this;
  };

  Field.prototype.addOption = function(opt) {
    return this.addOptions([opt]);
  };

  Field.prototype.addOptions = function(opts) {
    var o;
    if (this.type === "list-single" || this.type === "list-multi") {
      if (typeof opts[0] !== "object") {
        opts = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = opts.length; _i < _len; _i++) {
            o = opts[_i];
            _results.push(new Option({
              value: o.toString()
            }));
          }
          return _results;
        })();
      }
      helper.fill(opts, this.options, Option);
    }
    return this;
  };

  Field.prototype.toJSON = function() {
    var json, o, _i, _len, _ref;
    json = {
      type: this.type,
      "var": this["var"],
      required: this.required
    };
    if (this.desc) {
      json.desc = this.desc;
    }
    if (this.label) {
      json.label = this.label;
    }
    if (this.values) {
      json.values = this.values;
    }
    if (this.options) {
      json.options = [];
      _ref = this.options;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        o = _ref[_i];
        json.options.push(o.toJSON());
      }
    }
    return json;
  };

  Field.prototype.toXML = function() {
    var attrs, o, v, xml, _i, _j, _len, _len1, _ref, _ref1;
    attrs = {
      type: this.type,
      "var": this["var"]
    };
    if (this.label) {
      attrs.label = this.label;
    }
    xml = $build("field", attrs);
    if (this.desc) {
      xml.c("desc").t(this.desc).up();
    }
    if (this.required) {
      xml.c("required").up();
    }
    if (this.values) {
      _ref = this.values;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        v = _ref[_i];
        xml.c("value").t(v.toString()).up();
      }
    }
    if (this.options) {
      _ref1 = this.options;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        o = _ref1[_j];
        xml.cnode(o.toXML()).up();
      }
    }
    return xml.tree();
  };

  Field.prototype.toHTML = function() {
    var el, k, line, o, opt, txt, val, _i, _j, _len, _len1, _ref, _ref1, _ref2;
    switch (this.type.toLowerCase()) {
      case 'list-single':
      case 'list-multi':
        el = $("<select>");
        if (this.type === 'list-multi') {
          el.attr('multiple', 'multiple');
        }
        if (this.options.length > 0) {
          _ref = this.options;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            opt = _ref[_i];
            if (!(opt)) {
              continue;
            }
            o = $(opt.toHTML());
            _ref1 = this.values;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              k = _ref1[_j];
              if (k.toString() === opt.value.toString()) {
                o.attr('selected', 'selected');
              }
            }
            o.appendTo(el);
          }
        }
        break;
      case 'text-multi':
      case 'jid-multi':
        el = $("<textarea>");
        txt = ((function() {
          var _k, _len2, _ref2, _results;
          _ref2 = this.values;
          _results = [];
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            line = _ref2[_k];
            _results.push(line);
          }
          return _results;
        }).call(this)).join('\n');
        if (txt) {
          el.text(txt);
        }
        break;
      case 'text-single':
      case 'boolean':
      case 'text-private':
      case 'hidden':
      case 'fixed':
      case 'jid-single':
        el = $("<input>");
        if (this.values) {
          el.val(this.values[0]);
        }
        switch (this.type.toLowerCase()) {
          case 'text-single':
            el.attr('type', 'text');
            el.attr('placeholder', this.desc);
            break;
          case 'boolean':
            el.attr('type', 'checkbox');
            val = (_ref2 = this.values[0]) != null ? typeof _ref2.toString === "function" ? _ref2.toString() : void 0 : void 0;
            if (val && (val === "true" || val === "1")) {
              el.attr('checked', 'checked');
            }
            break;
          case 'text-private':
            el.attr('type', 'password');
            break;
          case 'hidden':
            el.attr('type', 'hidden');
            break;
          case 'fixed':
            el.attr('type', 'text').attr('readonly', 'readonly');
            break;
          case 'jid-single':
            el.attr('type', 'email');
        }
        break;
      default:
        el = $("<input type='text'>");
    }
    el.attr('name', this["var"]);
    if (this.required) {
      el.attr('required', this.required);
    }
    return el[0];
  };

  Field.fromXML = function(xml) {
    var o, v;
    xml = $(xml);
    return new Field({
      type: xml.attr("type"),
      "var": xml.attr("var"),
      label: xml.attr("label"),
      desc: xml.find("desc").text(),
      required: xml.find("required").length === 1,
      values: (function() {
        var _i, _len, _ref, _results;
        _ref = xml.find("value");
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          v = _ref[_i];
          _results.push(($(v)).text());
        }
        return _results;
      })(),
      options: (function() {
        var _i, _len, _ref, _results;
        _ref = xml.find("option");
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          o = _ref[_i];
          _results.push(Option.fromXML(o));
        }
        return _results;
      })()
    });
  };

  Field._htmlElementToFieldType = function(el) {
    var r, type;
    el = $(el);
    switch (el[0].nodeName.toLowerCase()) {
      case "textarea":
        type = "text-multi";
        break;
      case "select":
        if (el.attr("multiple") === "multiple") {
          type = "list-multi";
        } else {
          type = "list-single";
        }
        break;
      case "input":
        switch (el.attr("type")) {
          case "checkbox":
            type = "boolean";
            break;
          case "email":
            type = "jid-single";
            break;
          case "hidden":
            type = "hidden";
            break;
          case "password":
            type = "text-private";
            break;
          case "text":
            r = el.attr("readonly") === "readonly";
            if (r) {
              type = "fixed";
            } else {
              type = "text-single";
            }
        }
    }
    return type;
  };

  Field.fromHTML = function(html) {
    var el, f, txt, type;
    html = $(html);
    type = Field._htmlElementToFieldType(html);
    f = new Field({
      type: type,
      "var": html.attr("name"),
      required: html.attr("required") === "required"
    });
    switch (type) {
      case "list-multi":
      case "list-single":
        f.values = (function() {
          var _i, _len, _ref, _results;
          _ref = html.find("option:selected");
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            el = _ref[_i];
            _results.push(($(el)).val());
          }
          return _results;
        })();
        f.options = (function() {
          var _i, _len, _ref, _results;
          _ref = html.find("option");
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            el = _ref[_i];
            _results.push(Option.fromHTML(el));
          }
          return _results;
        })();
        break;
      case "text-multi":
      case "jid-multi":
        txt = html.text();
        if (txt.trim() !== "") {
          f.values = txt.split('\n');
        }
        break;
      case 'text-single':
      case 'boolean':
      case 'text-private':
      case 'hidden':
      case 'fixed':
      case 'jid-single':
        if (html.val().trim() !== "") {
          f.values = [html.val()];
        }
    }
    return f;
  };

  return Field;

})();

Option = (function() {

  function Option(opt) {
    this.toHTML = __bind(this.toHTML, this);

    this.toJSON = __bind(this.toJSON, this);

    this.toXML = __bind(this.toXML, this);
    if (opt) {
      if (opt.label) {
        this.label = opt.label.toString();
      }
      if (opt.value) {
        this.value = opt.value.toString();
      }
    }
  }

  Option.prototype.label = "";

  Option.prototype.value = "";

  Option.prototype.toXML = function() {
    return ($build("option", {
      label: this.label
    })).c("value").t(this.value.toString()).tree();
  };

  Option.prototype.toJSON = function() {
    return {
      label: this.label,
      value: this.value
    };
  };

  Option.prototype.toHTML = function() {
    return ($("<option>")).attr('value', this.value).text(this.label || this.value)[0];
  };

  Option.fromXML = function(xml) {
    return new Option({
      label: ($(xml)).attr("label"),
      value: ($(xml)).text()
    });
  };

  Option.fromHTML = function(html) {
    return new Option({
      value: ($(html)).attr("value"),
      label: ($(html)).text()
    });
  };

  return Option;

})();

Item = (function() {

  function Item(opts) {
    this.toHTML = __bind(this.toHTML, this);

    this.toJSON = __bind(this.toJSON, this);

    this.toXML = __bind(this.toXML, this);
    this.fields = [];
    if (opts != null ? opts.fields : void 0) {
      helper.fill(opts.fields, this.fields, Field);
    }
  }

  Item.prototype.toXML = function() {
    var f, xml, _i, _len, _ref;
    xml = $build("item");
    _ref = this.fields;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      f = _ref[_i];
      xml.cnode(f.toXML()).up();
    }
    return xml.tree();
  };

  Item.prototype.toJSON = function() {
    var f, json, _i, _len, _ref;
    json = {};
    if (this.fields) {
      json.fields = [];
      _ref = this.fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        f = _ref[_i];
        json.fields.push(f.toJSON());
      }
    }
    return json;
  };

  Item.prototype.toHTML = function() {
    var f, fieldset, _i, _len, _ref;
    fieldset = $("<fieldset>");
    _ref = this.fields;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      f = _ref[_i];
      (helper.createHtmlFieldCouple(f)).appendTo(fieldset);
    }
    return fieldset[0];
  };

  Item.fromXML = function(xml) {
    var f, fields;
    xml = $(xml);
    fields = xml.find("field");
    return new Item({
      fields: (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = fields.length; _i < _len; _i++) {
          f = fields[_i];
          _results.push(Field.fromXML(f));
        }
        return _results;
      })()
    });
  };

  Item.fromHTML = function(html) {
    var f;
    return new Item({
      fields: (function() {
        var _i, _len, _ref, _results;
        _ref = helper.getHtmlFields(html);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          f = _ref[_i];
          _results.push(Field.fromHTML(f));
        }
        return _results;
      })()
    });
  };

  return Item;

})();

Strophe.x = {
  Form: Form,
  Field: Field,
  Option: Option,
  Item: Item
};

$form = function(opt) {
  return new Strophe.x.Form(opt);
};

$field = function(opt) {
  return new Strophe.x.Field(opt);
};

$opt = function(opt) {
  return new Strophe.x.Option(opt);
};

$item = function(opts) {
  return new Strophe.x.Item(opts);
};

Strophe.addConnectionPlugin('x', {
  init: function(conn) {
    Strophe.addNamespace('DATA', 'jabber:x:data');
    if (conn.disco) {
      return conn.disco.addFeature(Strophe.NS.DATA);
    }
  },
  parseFromResult: function(result) {
    var _ref;
    if (result.nodeName.toLowerCase() === "x") {
      return Form.fromXML(result);
    } else {
      return Form.fromXML((_ref = ($(result)).find("x")) != null ? _ref[0] : void 0);
    }
  }
});

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

			me.connection.PubSub.bind('xmpp:pubsub:last-published-item', function(obj) {
				try {
					me._processLastPublishedItem(obj.node, obj.id, obj.entry, obj.timestamp);
				} catch (e) {
					printStackTrace(e);
				}
			});
			me.connection.PubSub.bind('xmpp:pubsub:item-published', function(obj) {
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
	this.connection.PubSub.items(device.nodeName + "_meta").done(successCallback).fail(failureCallback);
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
		}).done(successMetaCallback).fail(failureCallback);
	};
	console.log("[SoxClient.js] Creating " + device.nodeName);

	// first create _data node
	this.connection.PubSub.createNode(device.nodeName + "_data", {
		'pubsub#access_model' : device.accessModel,
		'pubsub#publish_model' : device.publishModel,
		'pubsub#max_items' : 1
	}).done(successDataCallback).fail(failureCallback);

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
		me.connection.PubSub.deleteNode(device.nodeName + "_meta").done(successMetaCallback).fail(failureCallback);
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
	this.connection.PubSub.deleteNode(device.nodeName + "_data").done(successDataCallback).fail(failureCallback);

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
	// this.connection.PubSub.discoverNodes(query+"_meta").done(successCallback).fail(failureCallback);
	// }else{
	this.connection.PubSub.discoverNodes().done(successCallback).fail(failureCallback);
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
		this.connection.PubSub.publish(device.nodeName + "_data", new Strophe.Builder('data').t(device.toDataString()).tree(), device.nodeName + "_data").done(
				successDataCallback).fail(failureCallback);
	}

	if (device.isMetaDirty()) {
		this.connection.PubSub.publish(device.nodeName + "_meta", new Strophe.Builder('device', {
			name : device.name,
			type : device.type
		}).t(device.toMetaString()).tree(), 'metaInfo').done(successMetaCallback).fail(failureCallback);
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
		me.connection.PubSub.subscribe(device.nodeName + "_data").done(successDataCallback).fail(failureCallback);
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
	this.connection.PubSub.subscribe(device.nodeName + "_meta").done(successMetaCallback).fail(failureCallback);

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
		this.connection.PubSub.unsubscribe(device.nodeName + "_meta").done(successMetaCallback).fail(failureCallback);
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
	this.connection.PubSub.unsubscribe(device.nodeName + "_data").done(successDataCallback).fail(failureCallback);

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
			me.connection.PubSub.unsubscribe(data[i].node, data[i].jid, data[i].subid).done(function() {
				var now = new Date();
				console.log("[SoxClient.js] " + now + " unsubscribed " + data[i].node + ", " + data[i].jid);
			}).fail(function() {
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
	this.connection.PubSub.getSubscriptions().done(successCallback).fail(failureCallback);

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
		for (var i = 0; i < transducerValues.length; i++) {
			var data = SensorData.fromXMLString(transducerValues.eq(i));
			if (!data) {
				/* Transducerに値が入っていないとき、上の関数はnullを返す。ので、それの処理を飛ばす */
				continue;
			}
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
		if (this.soxEventListener) {
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
    var jQueryObject = $(xml);
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