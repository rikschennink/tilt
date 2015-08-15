(function(root,factory,undefined){

	// CommonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = factory(root);
	}
	// AMD
	else if (typeof define === 'function' && define.amd) {
		define(factory(root));
	}
	// Global
	else {
		root['Tile'] = factory(root);
	}

}(this,function(root,undefined){

	'use strict';

	// constants
	var TRANSITION_SPEED = 125;
	
	// setup basic tilt css
	var css = '.tilt {' +

	// no backfaces please
	'backface-visibility:hidden;-webkit-backface-visibility: hidden;' +

	// remove iOS/Android tap highlight overlay
	'-webkit-highlight:none;-webkit-tap-highlight-color:rgba(0,0,0,0);' +

	// children should be transformed in tile perspective
	'-webkit-transform-style:preserve-3d;transform-style:preserve-3d;' +

	// animation speed
	'-webkit-transition:-webkit-transform ' + TRANSITION_SPEED + 'ms;transition:transform ' + TRANSITION_SPEED + 'ms;' +

	// would be odd if elements where placed outside of the tile, also fixes some rendering issues
	'overflow:hidden;' +

	// required to have gradient overlay line up correctly
	'position: relative;' +
	'}' +

	// shadow properties
	'.tilt-shadow-inner {' +
	'position:absolute;opacity:0;top:0;left:0;right:0;bottom:0;z-index:9999;' +
	'background:linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.25))' +

	// animation speed
	'-webkit-transition:opacity ' + TRANSITION_SPEED + 'ms;transition:opacity ' + TRANSITION_SPEED + 'ms;' +
	'}';

	// append block
	var style = document.createElement('style');
	style.type = 'text/css';
	style.appendChild(document.createTextNode(css));
	document.head.appendChild(style);

	// regexp to match colors in linear gradient
	var colorRegExp = /(transparent|rgba.+?\))/gi;

	// helper methods
	var Event = {
		DOWN: ['touchstart', 'pointerdown', 'mousedown'],
		UP: ['touchend', 'touchcancel', 'pointerup', 'mouseup', 'dragend']
	};

	function owns(object, property) {
		return object.hasOwnProperty(property);
	}

	function isEventOfType(e, type) {
		return type.indexOf(e.type)!==-1;
	}

	function addEvent(obj, event, scope) {
		event.forEach(function(event){
			obj.addEventListener(event,scope,false);
		});
	}

	function removeEvent(obj, event, scope) {
		event.forEach(function(event){
			obj.removeEventListener(event,scope,false);
		});
	}

	function getPositionByEvent(event) {
		if (event.type.indexOf('touch') === 0) {
			event = event.touches[0] || event.changedTouches[0];
		}
		return {
			x:event.pageX,
			y:event.pageY
		};
	}

	function getElementRect(element) {

		var rect = element.getBoundingClientRect();
		var doc = element && element.ownerDocument;
		var docElem = doc.documentElement;

		return {
			top: rect.top + root.pageYOffset - docElem.clientTop,
			left: rect.left + root.pageXOffset - docElem.clientLeft,
			width: rect.width,
			height: rect.height
		};

	}

	function shouldPrefix(property) {
		return /transform/i.test(property);
	}

	function getStyles(element) {

		var entry;
		var styles = {};
		(element.getAttribute('style') || '')

			// split so we get the various properties
			.split(';')

			// filter (style attribute could end in ;)
			.filter(function(style){return style.length;})

			// convert to object properties
			.map(function(style){
				entry = style.split(':');
				styles[entry[0]] = entry[1];
			}

		);
		return styles;

	}

	function setStyles(element, styles) {

		var text = '';
		var prop;
		var cur = getStyles(element);

		// set current styles
		for (prop in cur) {
			if (!owns(cur,prop)) {
				continue;
			}
			text += prop + ':' + cur[prop] + ';';
		}

		// set new styles
		for (prop in styles) {
			if (!owns(styles,prop)){
				continue;
			}

			// normal version
			text += prop + ':' + styles[prop] + ';';

			// test if should prefix
			if (shouldPrefix(prop)) {
				text += '-webkit-' + prop + ':' + styles[prop] + ';';
			}
		}

		element.style.cssText = text;
	}

	function toTransformValue(transforms) {
		return transforms.map(function(transform){
			return transform.name + '(' + transform.value + ')';
		}).join(' ')
	}

	function mergeOptions(base, additives) {

		var key;
		var options = {};
		var optionsToMerge = additives || {};

		for (key in base) {
			if (!owns(base,key)){continue;}
			options[key] = typeof optionsToMerge[key] === 'undefined' ? base[key] : optionsToMerge[key];
		}

		return options;
	}

	function getTransformOriginByPivot(pivot) {
		return pivot === 'none' ? '50% 50%' : pivot;
	}

	function isHorizontalPivot(pivot) {
		return /(left|right|center)/i.test(pivot);
	}

	function isVerticalPivot(pivot) {
		return /(top|bottom|center)/i.test(pivot);
	}

	function limit(value,min,max) {
		return Math.max(min,Math.min(value,max))
	}

	function getGradientByElement(element, angle) {

		var styles = window.getComputedStyle(element);
		var gradient = styles.getPropertyValue('background-image');

		// add offset to first color
		var i=0;
		var shadow = gradient.replace(colorRegExp,function(match){
			if (i==0) {
				i++;
				return match + ' 25%';
			}
			return match;
		});

		// rotate gradient
		shadow = angle + 'deg, ' + shadow;

		return 'linear-gradient(' + shadow + ')';
	}

	var LIGHT = {
		'top':180,
		'right':270,
		'bottom':0,
		'left':90
	};

	/**
	 * Tilt Class
	 * @param element
	 * @param options
	 * @constructor
	 */
	var exports = function Tile(element, options) {

		// remember element, it's going to be tilted later on
		this._element = element;

		// set custom options object
		this._options = mergeOptions(exports.options, options);

		// tap timeout
		this._tapTimeout = null;

		// let's go!
		this._init();

	};

	exports.options = {

		// pivot point: center, top, left, bottom, right, none
		pivot: 'center',

		// maximum depth to tilt
		depth: 15,

		// perspective of tilt
		perspective: '500px',

		// will render an inner shadow effect
		shadow: 'rgba(0,0,0,.25)'
	};

	exports.prototype = {

		// route events
		handleEvent:function(e) {

			// prevent double taps (then mousedown and touchstart are fired in quickly after each other)
			if (this._tapTimeout) {
				return;
			}

			// decide if we are pushing or lifting
			if (isEventOfType(e,Event.DOWN)) {
				this._onPush(e);
			}
			else {
				this._onLift();

				// after lifting unlock new push after time it takes to transition to original position
				var self = this;
				clearTimeout(this._tapTimeout);
				this._tapTimeout = setTimeout(function(){
					clearTimeout(self._tapTimeout);
					self._tapTimeout = null;
				},TRANSITION_SPEED);

			}

		},

		wraps:function(element) {
			return element === this._element;
		},

		// initialise tilt behavior on element
		_init:function() {

			// add gradient overlay for lighting effects
			if (this._options.shadow && this._options.pivot !== 'none') {
				this._element.innerHTML += '<span class="tilt-shadow-inner"></span>';
			}

			// listen to down events, that's basically the only thing we need to do to set this up
			addEvent(this._element,Event.DOWN,this);

			// loaded
			this._element.dataset.tileState = 'ready';
		},

		_onPush:function(e) {

			// listen to up so we can untilt on release action
			addEvent(document, Event.UP, this);

			// get event position, need this to determine the tilt amount in the tilt method
			var position = getPositionByEvent(e);

			// get element size rectangle (used to determine click position)
			var rect = getElementRect(this._element);

			// tilt the tile based on interaction position
			this.tilt(position.x - rect.left, position.y - rect.top);

		},

		_onLift:function() {

			removeEvent(document, Event.UP, this);

			this.untilt();

		},

		tilt:function(x, y) {

			var rect;
			var tiltX;
			var tiltY;
			var maxTiltX;
			var maxTiltY;
			var moveZ;
			var pivotX;
			var pivotY;
			var transforms;
			var overlay;
			var opacity;
			var axis;
			var rotation;
			var depth = this._options.depth;
			var pivot = this._options.pivot;

			// determine axis to tilt
			axis = {
				x:isHorizontalPivot(pivot),
				y:isVerticalPivot(pivot)
			};

			// get current dimensions, same as above, also (could have changed since last click/tap, so need to get each time)
			rect = getElementRect(this._element);

			// test for empty x, y values
			x = typeof x === 'undefined' ? rect.width * .5 : x;
			y = typeof y === 'undefined' ? rect.height * .5 : y;

			// calculate percentage location from center
			x = limit(x,0,rect.width) / rect.width;
			y = limit(y,0,rect.height) / rect.height;

			// calculate the maximum angle the panel could rotate
			maxTiltX = Math.atan2(depth, rect.height * (pivot === 'center' ? .5 : 1)) * 180 / Math.PI;
			maxTiltY = Math.atan2(depth, rect.width * (pivot === 'center' ? .5 : 1)) * 180 / Math.PI;

			// get the pivot of rotation
			pivotX = !axis.x ? 0 : pivot === 'left' ? 0 : pivot === 'right' ? 1 : .5;
			pivotY = !axis.y ? 0 : pivot === 'top' ? 0 : pivot === 'bottom' ? 1 : .5;

			// modify based on tap offset
			tiltX = !axis.y ? 0 : (y - pivotY) * (pivot === 'center' ? 2 : 1) * -maxTiltX;
			tiltY = !axis.x ? 0 : (pivotX - x) * (pivot === 'center' ? 2 : 1) * -maxTiltY;

			// z translation only
			if (pivot === 'none') {
				moveZ = 1;
			}
			// center translation, z translation based on action position
			else if (pivot === 'center') {
				moveZ = 2 * (1 - Math.sin(.5 + (Math.abs(pivotX - x) + Math.abs(pivotY - y))));
			}
			// if axis x or axis y is locked, no z translation possible
			else {
				moveZ = 0;
			}

			// calculate transforms
			transforms = [
				{name:'perspective', value: this._options.perspective},
				{name:'rotateX', value: tiltX + 'deg'},
				{name:'rotateY', value: tiltY + 'deg'},
				{name:'translateZ', value:(moveZ * -depth) + 'px'}
			];

			// setup light effects
			if (this._options.shadow && pivot !== 'none') {

				opacity = Math.max(Math.abs(tiltX / maxTiltX),Math.abs(tiltY / maxTiltY));

				if (pivot === 'center') {
					rotation = 90 + Math.atan2(y - pivotY, x - pivotX) * 180 / Math.PI;
				}
				else {
					rotation = LIGHT[pivot];
				}

				// fetch overlay and manipulate gradient orientation
				overlay = this._element.querySelector('.tilt-shadow-inner');
				setStyles(overlay,{
					'opacity':opacity,
					'background':getGradientByElement(overlay, rotation)
				});
			}

			// apply transform styles to tile
			setStyles(this._element,{
				'transform-origin':getTransformOriginByPivot(pivot),
				'transform':toTransformValue(transforms)
			});

			// now actively pushed
			this._element.dataset.tileState = 'pushed';
		},

		untilt:function() {

			var overlay;
			var transforms;
			var pivot = this._options.pivot;

			// handle lighting
			if (this._options.shadow && pivot !== 'none') {
				overlay = this._element.querySelector('.tilt-shadow-inner');
				setStyles(overlay, {
					'opacity': 0
				});
			}

			// revert to up state
			transforms = [
				{name:'perspective',value:this._options.perspective},
				{name:'rotateX',value:'0'},
				{name:'rotateY',value:'0'},
				{name:'translateZ',value:'0'}
			];

			setStyles(this._element,{
				'transform-origin': getTransformOriginByPivot(pivot),
				'transform': toTransformValue(transforms)
			});

			this._element.dataset.tileState = 'released';

		},

		unload:function() {

			// clean up events that activate the behavior
			removeEvent(this._element,Event.DOWN,this);

			// move into lifted state
			this._onLift();

		}

	};

	return exports;

}));