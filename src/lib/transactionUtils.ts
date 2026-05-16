export const addDate = (d: Date, idx: number, freq: 'monthly' | 'weekly' | 'none') => {
  const newD = new Date(d);
  if (freq === 'monthly') newD.setMonth(newD.getMonth() + idx);
  if (freq === 'weekly') newD.setDate(newD.getDate() + idx * 7);
  return newD.toISOString();
};

export const createRecurringOrInstallments = (baseData: any) => {
  const { date, installments, frequency, isRecurring, uid, ...others } = baseData;
  const baseDate = new Date(date || new Date());
  const newTransactions: any[] = [];

  if (installments && installments > 1) {
    const group = Date.now();
    for (let i = 0; i < installments; i++) {
      newTransactions.push({
        ...others,
        uid,
        date: addDate(baseDate, i, 'monthly'),
        installmentGroup: group,
        installmentSequence: i + 1,
        totalInstallments: installments,
        // Only the first one keeps the payments/settled status if it was realized
        payments: i === 0 ? others.payments : undefined,
        settled: i === 0 ? (others.settled || false) : false
      });
    }
  } else if (isRecurring) {
    const count = frequency === 'weekly' ? 52 : 12;
    const recurringGroup = Date.now();
    for (let i = 0; i < count; i++) {
      newTransactions.push({
        ...others,
        uid,
        date: addDate(baseDate, i, frequency || 'monthly'),
        isRecurringEntry: true,
        recurringGroup,
        recurringFrequency: frequency || 'monthly',
        // Only the first one keeps the payments/settled status
        payments: i === 0 ? others.payments : undefined,
        settled: i === 0 ? (others.settled || false) : false
      });
    }
  } else {
    newTransactions.push({
      ...others,
      uid,
      date: baseDate.toISOString(),
      settled: others.settled || false
    });
  }
  return newTransactions;
};
