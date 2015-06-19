var __test = (function() {
	"use strict";

	var ivo = require(__dirname+'/../main.js');
	var $ivo = ivo.__test;
	
	var expect = require('chai').expect;
	
	describe('ivo schwarz', function() {
		describe('# thing', function() {
			it('should be awesome', function() {
				expect(true).to.equal(true);
			});
		});
	});
})();