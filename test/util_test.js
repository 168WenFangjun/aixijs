QUnit.test("Sample",function(assert) {
    {
        var weights = [0.4,0.3,0.3]
        var samples = [0,0,0]
        for (var i = 0; i < 10000; i++) {
            var s = Util.sample(weights)
            samples[s] += 1
        }
        assert.ok(samples[0] > 3800 && samples[0] < 4200)
        assert.ok(samples[1] > 2800 && samples[1] < 3200)
        assert.ok(samples[2] > 2800 && samples[2] < 3200)
    }
    {
        var weights = [1]
        var s = Util.sample(weights)
        assert.equal(s,0)
    }
})