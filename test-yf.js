const yahooFinance = require('yahoo-finance2').default;

async function test() {
    try {
        const res = await yahooFinance.screener({ scrIds: 'sec_technology' }, { count: 5 });
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
test();
