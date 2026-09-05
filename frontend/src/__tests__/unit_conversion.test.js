import {
  parseGenToWei,
  formatWeiToGen,
  computeShareWei,
  remainingShareWei,
  equalBasisPoints,
  sumBasisPoints,
  formatBpsPercent,
} from '../money.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runUnitConversionTests() {
  console.log('Starting Precision Unit Conversion Tests...');

  const smallestWei = parseGenToWei('0.000000000000000001');
  assert(smallestWei === 1n, `Test 1 Failed: expected 1n, got ${smallestWei}`);
  assert(formatWeiToGen(1n) === '0.000000000000000001', `Test 1 Format Failed: got ${formatWeiToGen(1n)}`);

  const pointOneWei = parseGenToWei('0.1');
  assert(pointOneWei === 100000000000000000n, `Test 2 Failed: got ${pointOneWei}`);
  assert(formatWeiToGen(100000000000000000n) === '0.1', 'Test 2 Format Failed');

  const millionWei = parseGenToWei('1000000');
  assert(millionWei === 1000000000000000000000000n, `Test 3 Failed: got ${millionWei}`);
  assert(formatWeiToGen(1000000000000000000000000n) === '1000000', 'Test 3 Format Failed');

  const testValues = ['1', '0.5', '100.25', '0.000001', '30000', '123.456'];
  for (const val of testValues) {
    const wei = parseGenToWei(val);
    const formatted = formatWeiToGen(wei);
    assert(formatted === val, `Round-trip Failed for ${val}: got ${formatted}`);
  }

  const stewardWei = parseGenToWei('123.456');
  assert(stewardWei === 123456000000000000000n, `Steward Failed: got ${stewardWei}`);
  assert(formatWeiToGen(stewardWei) === '123.456', `Steward format Failed: got ${formatWeiToGen(stewardWei)}`);

  assert(parseGenToWei('') === 0n, 'empty should be 0n');
  assert(parseGenToWei('abc') === 0n, 'invalid should be 0n');
  assert(formatWeiToGen(0n) === '0', 'zero format');

  const total = parseGenToWei('10');
  const half = computeShareWei(total, 5000);
  assert(half === parseGenToWei('5'), `5000 bps of 10 GEN should be 5, got ${formatWeiToGen(half)}`);

  const dustTotal = 100n;
  assert(computeShareWei(dustTotal, 3333) === 33n, 'floor(100 * 3333 / 10000) should be 33');
  assert(computeShareWei(dustTotal, 3334) === 33n, 'floor(100 * 3334 / 10000) should be 33');

  const rem = remainingShareWei(total, 5000, parseGenToWei('2'));
  assert(rem === parseGenToWei('3'), `remaining after 2 of 5 should be 3, got ${formatWeiToGen(rem)}`);

  const three = equalBasisPoints(3);
  assert(three.length === 3, 'equal split length');
  assert(sumBasisPoints(three) === 10000n, `equal 3-way must sum to 10000, got ${sumBasisPoints(three)}`);
  assert(three[0] === '3333' && three[1] === '3333' && three[2] === '3334', `remainder goes to last member: ${three}`);

  const two = equalBasisPoints(2);
  assert(sumBasisPoints(two) === 10000n, 'equal 2-way must sum to 10000');
  assert(two[0] === '5000' && two[1] === '5000', '2-way should be 5000/5000');

  assert(formatBpsPercent(5000) === '50%', `50% format, got ${formatBpsPercent(5000)}`);
  assert(formatBpsPercent(3333) === '33.33%', `33.33% format, got ${formatBpsPercent(3333)}`);

  console.log('All precision unit conversion tests passed.');
}

runUnitConversionTests();
