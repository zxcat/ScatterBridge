import "mocha"
import { assert } from "chai"
import Helpers from "../src/util/Helpers";

describe("Helpers", () => {

	it('should be able to', async () => {
		console.log(Helpers.fixTrailingZeroes('1.000020000001'));
	});

});