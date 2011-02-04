(function() {
	
	// Javascript Simple Search Engine (JSSE)
	//
	// Copyright 2010 Planbox Inc. (www.planbox.com)
	// Authors: Martin Drapeau, Sebastien Giroux
	//
	// JSSE is a simple search engine featuring dynamic indexing and partial
	// word matching (a.k.a trailing wildcard query).
	// Very useful for increasing performance of auto-completes.
	//
	// Create an instance like this:
	//   se = new Jsse();
	//
	// Index a text found in a document like this:
	//   se.add('Instant search in Google is awesome!', 'quote');
	//   se.add('It will work find after you install that patch.', 'instruction');
	//   se.add('I bought a red car.', 'mid-life crisis');
	//
	// Find a match like this:
	//   se.match('inst');
	// Returns: 
	//   ['quote', 'instruction']
	// 
	// JSSE is dynamic. You can remove what you've previously added.
	//   se.remove('Instant search in Google is awesome!', 'quote');
	
	Jsse = function() {
		// List of words not to index
		this.stop_list = ['at', 'to', 'we', 'my', 'as', 'is', 'in', 'am','I','he','she','that','the','them','a'];
		
		// Number of indexed words
		this.size = 0;
		
		// The index collection of words
		// Each indexed word is an object named word with these attributes:
		//   weight
		//   count
		//   keys
		this.collection = {};
		
		// Keys that were added to the colleciton
		this.keys  = {};
		
		// Indexes a string and adds its normalized words to the collection.
		// Attaches the passed key to each indexed word.
		this.add = function(str, key) {
			if (key) this.keys[key] = str;
			this._merge(this._index(str), key);
			return this;
		};
		
		// Removes indexed words. Arguments str and key must be the same 
		// previously passed to add.
		this.remove = function(str, key) {		
			if (this.size == 0) return this;
			this._remove(this._index(str), key);
			if (key) delete(this.keys[key]);
			return this;
		};
		
		// Clears the collection
		this.clear = function() {
			this.collection = {};
			this.size = 0;
			return this;
		};
		
		// Returns an array with all indexed words
		this.getWords = function() {
			var words = [];
			for (word in this.collection) words.push(word);
			return words;
		};
		
		// Given a string, finds the keys which match all partial
		// or full words. Matching mode can either be all to match all 
		// keywords or any to match any keywords.
		// Returns an array of keys.
		this.match = function(str, mode) {
			mode || (mode = 'all');
		
			// Index the string assuming each word is a partial.
			// Finds existing words in the index.
			var index = this._indexAgainst(str);
			var size = 0;
			for (word in index) {
				if (word == index[word].orig) size += 1;
			}
			
			// First, find all keys matching any word
			var keys = {}, nb_keys = 0, orig, found;
			
			for (var word in index) {
				orig = index[word].orig;
				found = this.collection[word];
				if (found) {
					for (var i in found.keys) {
						var key = found.keys[i];				
						
						if (keys[key]) {
							if (indexOf(keys[key], orig) == -1) {
								keys[key].push(orig);
							}
						} else {
							keys[key] = [orig];
							nb_keys++;
						}
					}
				}
			}
			
			// Second, pick keys matching all words and
			// construct our resulting array
			if (mode == 'all') {		
				// Match all
				var result = [];
				for (var key in keys)
					if (keys[key].length == size) result.push(key);
			} else {
				// Match any and sort by relevancy
				var nb_keywords = [];
				for (var key in keys)
					nb_keywords[key] = this._nb_keywords_found(key,str);
				
				sorted_keys = this._sort_assoc_array(nb_keywords);
				
				result = [];
				for (key in sorted_keys)
					result.push(sorted_keys[key].key);
			}
			
			return result;
		};
		
		this._sort_assoc_array = function(keys) {
			var sorted_keys = new Array();
			for (i in keys) {
				sorted_keys.push({key: i, value: keys[i]});
			}
			sorted_keys.sort(function (x, y) {return y.value - x.value;});
			return sorted_keys;
		};
		
		// Private helper that return the number of keywords found for an index
		this._nb_keywords_found = function(key,words) {
			var arr_words = words.split(' ');
			
			var string = this.keys[key];
			if (!string) return 0;
			var nb_found = 0;
			
			for (word in arr_words) {
				word = arr_words[word].trim();
				if (word == '') continue;
				
				var start = 0;
				while (string.indexOf(word,start) > -1) {
					nb_found++;
					start = string.indexOf(word,start) + word.length;
				}
			}
			
			// Perfect match!
			if (words == string) nb_found = Math.pow(nb_found,2);
			
			return nb_found;
		};
		
		// Private helper which merges an index into the collection
		this._merge = function(index, key) {
			var collection = this.collection, keys;
			for (var word in index) {
				if (collection[word]) {
					collection[word].count++;
					if (key) collection[word].keys.push(key);
				} else {
					keys = [];
					if (key) keys.push(key);
			
					collection[word] = index[word];
					collection[word]['keys'] = keys;
					
					this.size++;
				}
			}
			return this;
		};
		
		// Private helper which performs the reverse of _merge
		this._remove = function(index, key) {
			var collection = this.collection;
			for (var word in index) {
				if (collection[word]) {
					collection[word].count--;
					if (key) removeFromArray(collection[word].keys, key);
					if (collection[word].count == 0) {
						delete(collection[word]);
						this.size--;
					}
				}
			}
			return this;
		};
		
		// Private helper function to index one string against the
		// collection. Does trailing wildcard query to find partial matches
		// for words. Ignores words that are too small.
		// Returns an index array in the form:
		//   index[<word>] = {orig:<original word in str>, weight:<word.length>, count:<number of times the word is found>}
		//
		// For example, for str 'inst' may return words 'install' and 'instant'.
		this._indexAgainst = function(str) {
			var index_tmp = this._index(str);
			var index = {}
			for (var word in index_tmp) {
				var record = index_tmp[word];
				record.orig = word;
				index[word] = record;
			}
			for (var word in this.collection) {
				for (var partial in index_tmp) {
					if (word.indexOf(partial) == 0) {
						index[word] = {
							orig: partial,
							weight: partial.length,
							count: 1
						}
					}
				}
			}
			return index;
		};
	
		// Private helper function to index one string.
		// Returns an collection of indexed words in the form:
		//   index[<word>] = {weight:<word.length>, count:<number of times the word is found>}
		this._index = function(str) {
			// Construct an array of word objects which have:
			//   word - the word
			//   weigth - the weight of the word (use its length for now)
			//   count - the number of times it appears
			var index = {};
			if (!str) return index;
			var words = str.split(' ');
			for (var i =0; i < words.length; i++) {
				var word = this.normalize(words[i]);
				if (word.length < 2) continue;
				if (index[word]) {
					index[word].count++;
				} else {
					index[word] = {
						weight: word.length,
						count: 1
					}
				}
			}
			return index;
		};
		
		// Private helper function which normalizes a word removing 
		// unecessary things (i.e. dots and prepositions).
		// Also drops everything to lowercase.
		// TO DO: Remove plural and normalize to common class name.
		// Returns an empty string if the passed word was not pertinent.
		this.normalize = function(word) {
			word = word.toLowerCase();
			word = $.trim(word.replace(/[^a-z0-9_\-\s]/gi, ''));
			if (indexOf(this.stop_list, word) != -1) return '';
			return word;
		};
	};
	
	// Helper function to find an element in an array
	// Source: Underscore JS (http://documentcloud.github.com/underscore)
	indexOf = function(array, item) {
		if (Array.prototype.indexOf && array.indexOf === Array.prototype.indexOf) return array.indexOf(item);
		for (var i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
		return -1;
	};
	
	// Helper function to remove elements from an array
	removeFromArray = function(array, item) {
		if (array.length == 0) return;
		for (i = array.length-1; i >= 0; i--) {
			if (array[i] == item) array.splice(i);
		}
	}
	
})();