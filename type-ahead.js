/*
 type-ahead-find: find text or links as you write. 
 
 This script is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This script is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this script.  If not, see <http://www.gnu.org/licenses/>.
 
 Website: http://code.google.com/p/chrome-type-ahead/
 Author: Arnau Sanchez <tokland@gmail.com> (2009) 
*/ 

/* Styles and addStyle borrowed from nice-alert.js project */

var styles = '\
  #type-ahead-box {\
    position: fixed;\
    top: 0;\
    right: 0;\
    margin: 0;\
    text-align: left;\
    z-index: 9999;\
    //background-color: #FFC;\
    color: #000;\
    border-bottom: 1px solid #ccc;\
    border-bottom: 1px solid rgba(0,0,0,0.3);\
    padding: 4px 8px;\
    opacity: 0.9;\
    float: right;\
    clear: both;\
    overflow: hidden;\
    font-size: 18px;\
    font-family: Arial, Verdana, Georgia, Serif;\
    white-space: pre-wrap;\
    min-width: 60px;\
    outline: 0;\
    -webkit-box-shadow: 0px 2px 8px rgba(0,0,0,0.2);\
    -moz-box-shadow: 0px 2px 8px rgba(0,0,0,0.3);\
  }\
  \
  #type-ahead-box small {\
    letter-spacing: -0.12em;\
    color: #444;\
  }'

/* Generic functions */

function max(a, b) {
  return ((a > b) ? a : b); 
}

function get_current_zoom(doc) {
  var s = doc.body.parentElement.style.zoom;
  var zoom;
  if (s.match('%$'))
    zoom = parseFloat(s.slice(0, s.length - 1)) / 100;
  else if (s)
    zoom = parseFloat(s.replace(',', '.'));
  else
    zoom = 1;
  return (zoom);
}

function addStyle(css) {
  var head = document.getElementsByTagName('head')[0];
  if (head) {
    var style = document.createElement("style");
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    head.appendChild(style);
  }
}

function stopEvent(ev) {
  ev.preventDefault();
  ev.stopPropagation();
}
    
function up(element, tagName) {
  var upTagName = tagName.toUpperCase();
  while (element && (!element.tagName || 
                     element.tagName.toUpperCase() != upTagName)) {
    element = element.parentNode;
  }
  return element;
}

function upMatch(element, matchFunction) {
  while (element) {
    var res = matchFunction(element);
    if (res == null)
      return null;
    else if (res)
      return element;
    element = element.parentNode;
  }
  return element;
}

function isVisible(element) {
  while (element) {    
    style = window.getComputedStyle(element);
    if (style && (style.getPropertyValue('display') == 'none' ||
                  style.getPropertyValue('visibility') == 'hidden'))
      return false;
    element = element.parentNode;
  }
  return true;
}

function getRootNodes() {  
  var rootNodes = new Array();
  var frames = document.getElementsByTagName('frame');
  for (var i = 0; i < frames.length; i++)
    rootNodes.push(frames[i]);
  return rootNodes;
}

function clearRanges() {
  var rootNodes = [window].concat(getRootNodes());
  for (var i = 0; i < rootNodes.length; i++) {
    var w = rootNodes[i].contentDocument || rootNodes[i];
    if (w && w.getSelection) { 
      var selection = w.getSelection();    
      selection.removeAllRanges();
    }
  }
}

function getActiveElement(doc) {
	  return doc.activeElement || doc._tafActiveElement;
}

function getSelectedAnchor(doc) {
  var rootNodes = [document].concat(getRootNodes());
  for (var i = 0; i < rootNodes.length; i++) {
    var doc = rootNodes[i].contentDocument || rootNodes[i];
    var element = getActiveElement(doc);  
    if (element && element.tagName == "A")
      return(element);
  }
}

function isInputElementActive(doc) {
  var element = getActiveElement(doc);
  if (!element)
    return;
  var name = element.tagName.toUpperCase();
  if (name == "INPUT" || name == "SELECT" || name == "TEXTAREA")
    return true;
  return (upMatch(element, function(el) {
      if (!el.getAttribute || el.getAttribute('contenteditable') == 'false')
        return null;
      return (el.getAttribute('contenteditable') == 'true'); 
    }))
}

function selectOnchange(select) {
  if (select) {
    select.focus(); 
    if (select.onchange) 
      select.onchange();
    return true;
  }
}

function setAlternativeActiveDocument(doc) { 
  function dom_trackActiveElement(evt) {
    if (evt && evt.target) { 
      doc._tafActiveElement = (evt.target == doc) ? null : evt.target;
    }
  }

  function dom_trackActiveElementLost(evt) { 
    doc._tafActiveElement = null;
  }

  if (!doc.activeElement) {
    doc.addEventListener("focus", dom_trackActiveElement, true);
    doc.addEventListener("blur", dom_trackActiveElementLost, true);
  }
}

/* Type-ahead specific functions */

function clearSearchBox() {
  var box = document.getElementById('type-ahead-box');
  if (box) {
    box.style.display = 'none';
  }
}

function showSearchBox(search) {
  var colors = {
    text: {ok: '#FF5', ko: '#F55'},
    links: {ok: '#DDF', ko: '#F55'},
  }
  var box = document.getElementById('type-ahead-box');
  if (!box) { 
    box = document.createElement('TABOX');
    box.id = 'type-ahead-box';
    document.documentElement.appendChild(box);
    addStyle(styles);
  }
  box.style.display = 'block';
  if (search.mode) {
    var color = colors[search.mode][(search.total < 1 && search.text) ? 'ko' : 'ok'] 
    box.style['background-color'] = color;
  }
  box.innerHTML = search.text ? 
    (search.text + ' <small>(' + search.nmatch + ' of ' + search.total + ')</small>') : '&nbsp;';
  box.style['top'] = ''
  if (search.nmatch >= 1 && search.range) {
    var sel = search.range.getBoundingClientRect();
    if (sel.right >= box.offsetLeft && sel.top <= box.offsetTop + box.offsetHeight) {
      topval = (sel.bottom + 10);
      box.style['top'] = ((topval < 100) ? topval : 100)  + 'px';
    }
  }
}

function processSearch(search, options) {
  var selected = false;    
  var selectedAnchor = getSelectedAnchor();
  
  if (selectedAnchor)
    selectedAnchor.blur();
  
  if (search.text.length <= 0 || !search.mode) {
    clearRanges();
    return(selected);
  }
  
  var matchedElements = new Array();
  var string = search.text.replace(/\s+/g, "(\\s|\240)+");
  if (options.starts_link_only)
    string = '^' + string;
  var regexp =  new RegExp(string, options.case_sensitive ? 'g' : 'ig')
  // currently Xpath does not support regexp matches. That would be great:
  // document.evaluate('//a//*[matches(text(), "regexp")]', document.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(N);
  var rootNodes = [window].concat(getRootNodes());
  for (var i = 0; i < rootNodes.length; i++) {    
    var doc = rootNodes[i].document || rootNodes[i].contentDocument;
    if (!doc || !doc.body)
      continue;
    var frame = rootNodes[i].contentWindow || rootNodes[i];

    function match(textNode) {
      if (!regexp.test(textNode.data))
        return NodeFilter.FILTER_REJECT;
      var anchor = up(textNode, 'a');
      if ((search.mode == 'links' && !anchor) || 
          !isVisible(textNode.parentNode) ||
           up(textNode.parentNode, 'script'))
        return NodeFilter.FILTER_REJECT;
      var option = up(textNode.parentNode, 'option');
      if (option && !options.search_in_selects)
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  
    var nodeIterator = doc.createNodeIterator(
      doc.body,
      NodeFilter.SHOW_TEXT,
      match,
      true
    );    
      
    while ((textNode = nodeIterator.nextNode()) != null) {
      var anchor = up(textNode, 'a');
      var option = up(textNode.parentNode, 'option');
      var regexp2 = new RegExp(regexp);
      var result;
      while (match = regexp2.exec(textNode.data)) {
        result = {doc: doc, frame: frame, node: textNode, 
                      anchor: anchor, option: option, 
                      start: match.index, end: regexp2.lastIndex};
        matchedElements.push(result);
      }          
    }
  }
  
  search.total = matchedElements.length;

  if (matchedElements.length > 0) {
    var index = search.index % matchedElements.length;
    if (index < 0)
      index += matchedElements.length;
    search.nmatch = index + 1;      
    var result = matchedElements[index];
    search.element = result.node.parentNode;
    if (result.option) {
      result.option.selected = 'selected';
      search.select = up(result.option, 'select');
    } else {
      search.select = null;
    }
    clearRanges();
    
    var range = result.doc.createRange();    
    range.setStart(result.node, result.start);
    range.setEnd(result.node, result.end);
    var selection = window.getSelection();
    selection.addRange(range);
    search.range = range;
    selected = true;
    if (result.anchor) {
      result.anchor.focus();
    } else {
      var rect = range.getBoundingClientRect();
      var doc_height = window.innerHeight;
      var zoom = get_current_zoom(result.doc);
      if (zoom*rect.top < (doc_height * 1) / 6.0 || zoom*rect.bottom > (doc_height * 5) / 6.0) {  
        var y = max(0, window.pageYOffset + zoom*rect.top - doc_height / 3.0);
        window.scrollTo(window.pageXOffset + zoom*rect.left, y);
      }
    }
  } else {
    search.nmatch = 0;
    clearRanges();
  } 
  
  return(selected);
}

function check_blacklist(sites_blacklist) {
  if (sites_blacklist) {
    var url = window.location.href;
    var urls = options.sites_blacklist.split('\n');    
    for (var i=0; i < urls.length; i++) {
      var s = urls[i].replace(/^\s+|\s+$/g, '');
      // If URL starts with #, ignore it       
      // If URL starts with | assume it is a real regexp.
      // Otherwise check if url begings with this string
      if (s[0] == '#') {
        continue;
      } else if (s[0] == '|') {
        var regexp = new RegExp('^' + s.slice(1) + '$');
        if (url.match(regexp))
          return true;
      } else {
        if (url.slice(0, s.length) == s)
          return true;
      }
    }
  }
  return false;
}

function init(options) {
  var keycodes = {
    "backspace": 8,
    "tab": 9,
    "enter": 13,
    "spacebar": 32,
    "escape": 27,
    "n": 78,
    "p": 80,
    "g": 71,
    "f3": 114,
    "f4": 115,
  };

  function clearSearch(clearRanges) {
    search = {mode: null, text: '', index: 0, matches: 0, total: 0, select: null};
    if (clearRanges) { 
      selection = window.getSelection();
      selection.removeAllRanges();
    }
    clearSearchBox();
  }
   
  function processSearchWithOptions(blur_unless_found) {
    return processSearch(search, { 
      case_sensitive: options["case_sensitive"], 
      search_links: (search.mode == 'links'),
      search_in_selects: options["search_in_selects"],
      starts_link_only: options["starts_link_only"],
      blur_unless_found: blur_unless_found
    });    
  }

  function setEvents(rootNode) {
    var doc = rootNode.contentDocument || rootNode;
    var body = rootNode.body;

    body.addEventListener('keydown', function(ev) {
      if (isInputElementActive(doc))
        return;      
        
      var code = ev.keyCode;
      var selectedAnchor = getSelectedAnchor(doc);
      var blacklisted = check_blacklist(options.sites_blacklist);
      
      if (blacklisted && !search.mode)
        return;      
        
      if (code == keycodes.backspace && search.mode) {
        if (search.text) {
          search.text = search.text.substr(0, search.text.length-1);
          processSearchWithOptions(true);
          showSearchBox(search);
        }
      } else if (code == keycodes.escape && search.mode) {
        clearSearch(true);
        processSearchWithOptions(true);
      } else if (code == keycodes.enter && 
                 (selectedAnchor || selectOnchange(search.select))) {
        clearSearch(true);
        return;
      } else if (code == keycodes.tab && !selectedAnchor) {
        var nodeIterator = doc.createNodeIterator(
            doc.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );
        var textNode;
        while ((textNode = nodeIterator.nextNode()) != search.element);
        var nextNodeFuncName = ev.shiftKey ? "previousNode" : "nextNode"; 
        while ((textNode = nodeIterator[nextNodeFuncName]()) != null) {
          if (textNode.tagName == 'A' && textNode.href) {
            textNode.focus();
            break;
          }
        }
        clearSearch(true);
        stopEvent(ev);
        return;
      } else if (code == keycodes.tab) {
        clearSearch(true);
        return;
      } else if (code == keycodes.f4 && search.mode) {
        search.mode = (search.mode == 'text') ? 'links' : 'text'
        search.index = 0;
        processSearchWithOptions(true);
        showSearchBox(search);
      } else if (search.text && (code == keycodes.f3 ||
                                 (code == keycodes.g && (ev.ctrlKey || ev.metaKey)) ||
                                 (code == keycodes.n && ev.altKey) ||
                                 (code == keycodes.p && ev.altKey))) { 
        search.index += (ev.shiftKey || code == keycodes.p) ? -1 : +1;
        processSearchWithOptions(true);
        showSearchBox(search);
      } else {
        return;
      }
      
      stopEvent(ev);
    }, false);
    
    body.addEventListener('keypress', function(ev) {
      if (isInputElementActive(doc))
        return;
      var blacklisted = check_blacklist(options.sites_blacklist);
      var code = ev.keyCode;
      var ascii = String.fromCharCode(code);
      
      if (!ev.altKey && !ev.metaKey && !ev.ctrlKey && 
          ascii && code != keycodes.enter &&
          (code != keycodes.spacebar || search.mode)) {
        if (!search.mode && ascii == "/") {
          search.mode = 'text';
        } else if (!search.mode && ascii == "'") {
          search.mode = 'links';
        } else if (!search.mode && blacklisted) {
          return;
        } else if (!search.mode && options.direct_search_mode == 'disabled') {
          return;
        } else if (!search.mode) {
          search.mode = options.direct_search_mode == 'links' ? 'links' : 'text';
          search.text += ascii;
        } else if (search.mode) {
          search.text += ascii;
        }
        processSearchWithOptions(true)
        showSearchBox(search);
        stopEvent(ev)
      }
    }, false);
 
    body.addEventListener('mousedown', function(ev) {
      if (search.mode)
        clearSearch(false);      
    }, false);
    
    setAlternativeActiveDocument(doc);
  }

  clearSearch(false);
  var rootNodes = [document].concat(getRootNodes());
  for (var i = 0; i < rootNodes.length; i++) {
    var rootNode = rootNodes[i];
    if (rootNode.contentDocument) { 
      rootNode.addEventListener('load', function(ev) {
        setEvents(ev.target.contentDocument);
      });
    }
    else if (!rootNode.contentDocument || rootNode.contentDocument.readyState == 'complete')
      setEvents(rootNode.contentDocument ? rootNode.contentDocument : rootNode);
  } 
}

/* Default options */
var options = {
  direct_search_mode: 'text',
  case_sensitive: false,
  search_in_selects: false,
  starts_link_only: false,
  sites_blacklist: '',
};


/* Main */

if (chrome.extension) {
  chrome.extension.sendRequest({'get_options': true}, function(response) {
    options = {
      direct_search_mode: response.direct_search_mode,
      sites_blacklist: response.sites_blacklist,
      case_sensitive: (response.case_sensitive == '1'),
      search_in_selects: (response.search_in_selects == '1'),
      starts_link_only: (response.starts_link_only == '1'),
    };
    init(options);
  });
} else {
  // So this code can be used as stand-alone script (using default options)
  window.addEventListener('load', function(ev) {
    init(options);
  });
}
