// = Like.js source code =
//
// Behavior using CSS classes.

;(function(global) {

// some internal variables
var hasClass, byId, byTag, byClass, iterate, 
  doc = global.document, proto;

// ** {{{ Like constructor }}} **
//
// A Like object can take a DOM object as a scope. 
// The scope is used within DOM relative methods when the
// the dom parameter is left unspecified.
// by default the scope is the document.
function Like(scope) {
  // register of callback for every (class|event) couple
  this.register = {};
  // classes that have the likeInsert event
  this.insertClasses = [];
  this.scope = scope || doc;
}

// a shortcut for the prototype
proto = Like.prototype;

proto.toString = function(){return "Like("+this.scope.toString()+")"};

// ** {{{ like.iterate(object, callback) }}} **
//
// Iterate over an Array, calling a callback for each item.
// Returning false interrupt the iteration.
proto.iterate = iterate = function (obj, fct) {
  var i;
  for(i=0; i<obj.length; i++) {
    if(fct(obj[i]) === false) {
      // end of the iteration
      return false;
    }
  }
  // sucessful full iteration
  return true;
};

// ** {{{ like.hasClass(className, dom) }}} **
//
// Return true if the given DOM element has a given class.
proto.hasClass = hasClass = function (cls, dom) {
  var d = (dom || this.scope);
  var m = new RegExp("\\b" + cls + "\\b");
  return d.className && d.className.match(m);
};

// ** {{{ like.byId(Id, dom) }}} **
//
// Return a DOM element given it's ID
proto.byId = byId = function(id, dom){
  return (dom || this.scope).getElementById(id)};

// ** {{{ like.byTag(tagName, dom) }}} **
//
// Return a list of DOM element given a tag name.
proto.byTag = byTag = function(tag, dom){return (
  dom || this.scope).getElementsByTagName(tag)};

// ** {{{ like.byClass(className, dom) }}} **
//
// Return a list of DOM element given a class name.
proto.byClass = byClass = function(cls, dom) {
  var d = dom || this.scope;
  // apparently faster
  if(d.getElementsByClassName) {return d.getElementsByClassName(cls)};
  if(d.querySelectorAll) {return d.querySelectorAll("."+cls)};
  // < IE8
  var accu = [];
  iterate(byTag("*", d), function(el) {
    if(hasClass(cls, el)) {
      accu.push(el);
    }
  });
  return accu;
};

// ** {{{ like.listenTo(event, listener, dom) }}} **
//
// Listen to a particuliar even in a cross browser way.
proto.listenTo = function (event, listener, dom) {
  var d = dom || this.scope;
  if(d.addEventListener) {
    d.addEventListener(event, listener, false);
  } else if(d.attachEvent) {
    d.attachEvent("on" + event, function(e) {
      // fix IE so it has the target property
      e.target = e.target || e.srcElement;
      return listener(e);
    });
  }
};

// ** {{{ like.addClass(className, dom) }}} **
//
// Add a class on a given dom element.
proto.addClass = function(cls, dom) {
  var d = dom || this.scope;
  if(!hasClass(cls, d)) {
    d.className = d.className + " " + cls;
  }
}

// ** {{{ like.removeClass(className, dom) }}} **
//
// Remove a class on a given dom element.
proto.removeClass = function(cls, dom) {
  var d = dom || this.scope;
  var m = new RegExp("\\b" + cls + "\\b");
  d.className = d.className.replace(m, "");
}

// ** {{{ like.execute(event) }}} **
//
// Execute an event on the current target and bubble up trying
// to find behavioral classes. When one is found the couple 
// (class name, event name) is tested on the registery and if
// there is a match the event is executed.
//
// **event** The event to execute
proto.execute = function(event) {
  var target = event.target, signature, that=this, complete, fun, ret;
  while(target) {
    if(!target.className || target.className.indexOf("like-") == -1) {
      target = target.parentNode;
      continue;
    }
    complete = iterate(target.className.split(" "), function(cls) {
      if(cls.indexOf("like-") == 0) {
        signature = cls + "|" + event.type;
        if(that.register[signature]) {
           fun = that.register[signature];
           ret = fun.call(new Like(target), target, event);
           if(ret === false) {
              event.preventDefault();
           }
           return ret;
        }
      }
    });
    if(complete === false) {
      break;
    }
    target = target.parentNode;
  }
}

// ** {{{ like.registerEvent(className, eventName, callback) }}} **
//
// Add a (className, eventName) couple to the event registry. 
// Execute likeInit events and register the className in the insert table if likeInsert is present.
//
// * **className**  Class name upon to fire the event
// * **eventName**  The event name
// * **callback**   Callback defined by the user
proto.registerEvent = function(className, eventName, callback) {
  var signature = className + "|" + eventName, that=this;
  // only one event by signature is allowed
  if(!this.register[signature]) {
    function listener(e) {
      return that.execute(e);
    }
    this.listenTo(eventName, listener);
    this.register[signature] = callback;
    if(eventName == "likeInsert") {
      this.insertClasses.push(className);
    }
    if(eventName == "likeInit") {
      iterate(that.byClass(className), function(el) {
        callback.call(new Like(el), el, {type:"likeInit", target:el});
      });
    }
  }
}

// ** {{{ like.a(name, reactOn, obj) }}} **
// 
// Add behavior to the event register.
// 
// * **name**       Name of the behavior
// * **reactOn**    Space separated list of events, or a map of callbacks.
// * **obj**        Callback defined by the user, or a map of callbacks.

proto.a = proto.an = function(name, reactOn, obj) {
  var that=this, key;
  if(typeof reactOn == "object") {
    for(key in reactOn) {
      if(reactOn.hasOwnProperty(key)) {
        that.registerEvent("like-"+name, key, reactOn[key]);
      }
    }
    return;
  }
  iterate(reactOn.split(/[\s]+/), function(evt) {
    if(typeof obj == "object") {
      if(obj[evt]) {
        that.registerEvent("like-"+name, evt, obj[evt]);
      }
    } else {
      that.registerEvent("like-"+name, evt, obj);
    }
  });
}

// ** {{{ like.domInserted(dom) }}} **
// 
// Add behavior to the event register.
// 
// **dom** Fire the likeInsert events on all elements within a given DOM element.
proto.domInserted = function(dom) {
  var that = this, signature, fun;
  iterate(this.insertClasses, function(cls) {
    // search for dom element matching those classes
    iterate(byClass(cls, dom), function(el) {
       signature = cls + "|likeInsert";
       var fun = that.register[signature];
       if(fun) {
         fun.call(new Like(el), el, {type:"likeInsert", target:el});
       }
    });
  });
}

// ** {{{ like.insert(dom, html) }}} **
// 
// Insert some HTML into a DOM element
// 
// * **dom**       The targeted DOM element
// * **html**      HTML string
proto.insert = function(dom, html) {
  dom.innerHTML = html;
  this.domInserted(dom);
}

// ** {{{ like.data(key, [value]) }}} **
// 
// Set or get the data attribute of the current element
proto.data = function(key, value) {
  if(typeof value == "undefined") {
    return this.getData(key);
  } else {
    this.setData(key, value);
  }
}

// ** {{{ like.setData(key, value) }}} **
// 
// Save some content into the current dom element.
proto.setData = function(key, value, dom) {
  var d = this.scope || dom;
  if(typeof value == "undefined") {
    return d.removeAttribute("data-" + key);
  }
  d.setAttribute("data-" + key, "json:"+JSON.stringify(value));
}

// ** {{{ like.getData(key) }}} **
// 
// Return the content stored in the current element.
proto.getData = function(key, dom) {
  var d = (this.scope || dom);
  var v = d.getAttribute("data-" + key);
  if(v && v.indexOf("json:") === 0) {
    return JSON.parse(v.slice(5));
  }
  return v;
}

// ** {{{ like.here(dom) }}} **
//
// Shortcut to create a new Like object
proto.here = function(dom) {
  return new Like(dom);
}

// Export the module to the outside world
if(!global.like) {
  global.like = new Like(doc);
}

}(this));
