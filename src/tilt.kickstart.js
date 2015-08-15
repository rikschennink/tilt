/* TILT */

(function(root, factory, undefined){

	// cut the mustard
	// detect addEventListener, dataset, transition, requestAnimationFrame and transform support
	if (!root || !root.addEventListener) {
		return;
	}

	// CommonJS
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = factory(root,require('./tilt'));
	}
	// AMD
	else if (typeof define === 'function' && define.amd) {
		define(['./tilt'],function(tilt){factory(root,tilt)});
	}
	// Globals
	else {
		root['InstaTilt'] = factory(root,root['Tile']);
	}

}(this, function(root, Tile, undefined){

	'use strict';

	// if no tile class supplied, quit
	if (!Tile || !Document) {
		return;
	}

	// collection of all elements that have been turned into tiles
	var tiles = [];

	function getDAP(el,property) {
		return el.getAttribute('data-tilt-' + property);
	}

	// returns the index of the given element in the tilted elements array
	function getTileIndexByElement(element) {
		var i = 0;
		var l = tiles.length;
		for(;i<l;i++) {
			if (tiles[i].element !== element) {
				continue;
			}
			return i;
		}
		return -1;
	}

	// The InstaTilt public API
	var exports = {

		// parses a section of the DOM for tiles
		parse:function(context) {

			var elements;
			var element;
			var i;

			// find all tilt elements and bind Tilt behavior
			elements = context.querySelectorAll('.tilt');
			i = elements.length;

			while(i--) {
				element = elements[i];

				// test if element is already contained in array
				if (getTileIndexByElement(element) !== -1) {
					continue;
				}

				// add new tile
				tiles.push({

					// create tilt element
					tile:new Tile(element, {
						shadow:!(getDAP(element,'shadow') === 'false'),
						pivot:getDAP(element,'pivot') || Tile.options.pivot,
						perspective:getDAP(element,'perspective') || Tile.options.perspective,
						depth:parseInt(getDAP(element,'depth'),10) || Tile.options.depth
					}),

					// remember element for later retrieval of tile
					element:element

				});
			}

		},

		// returns the tile instance bound to the element
		getTileByElement:function(element) {
			if (typeof element === 'string') {
				element = document.querySelector(element);
			}
			if (!element) {
				return null;
			}
			var index = getTileIndexByElement(element);
			if (!index) {
				return null;
			}
			return tiles[index].tile;
		},

		// removes tilt from an element
		unload:function(element) {
			var index = getTileIndexByElement(element);
			var tile = tiles[index].tile;
			tile.unload();
			tiles.splice(index,1);
		}
	};

	// Initialize all nodes within the document context that should be turned into tiles
	function kick() {
		exports.parse(document);
	}

	// if doc already interactive/complete than setup immediately, else wait for DOMContentLoaded
	if (document.readyState !== 'loading') {
		kick();
	}
	else {
		document.addEventListener('DOMContentLoaded',kick);
	}

	// expose for API use
	return exports;

}));