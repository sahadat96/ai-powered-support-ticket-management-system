import { LocalTicketAnalyzer } from '../src/modules/ai/infrastructure/local-ticket-analyzer';
import { EVALUATION_DATA } from '../src/modules/ai/infrastructure/evaluation-data';
import { CATEGORIES } from '../src/modules/tickets/domain/ticket';

async function run() {
  const model = new LocalTicketAnalyzer();
  const rows = await Promise.all(
    EVALUATION_DATA.map(async (row) => ({
      expected: row.category,
      predicted: (await model.analyze('', row.text)).category,
      text: row.text,
    })),
  );
  const correct = rows.filter((r) => r.expected === r.predicted).length;
  console.log(
    JSON.stringify(
      {
        model: 'local-nb-v1',
        dataset:
          '16 held-out synthetic English examples; not a real-world benchmark',
        correct,
        total: rows.length,
        accuracy: correct / rows.length,
        perCategory: Object.fromEntries(
          CATEGORIES.map((c) => [
            c,
            {
              correct: rows.filter((r) => r.expected === c && r.predicted === c)
                .length,
              total: rows.filter((r) => r.expected === c).length,
            },
          ]),
        ),
        errors: rows.filter((r) => r.expected !== r.predicted),
      },
      null,
      2,
    ),
  );
}
run();
