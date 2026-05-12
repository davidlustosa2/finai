export const addDate = (d: Date, idx: number, freq: 'monthly' | 'weekly' | 'none') => {
  const newD = new Date(d);
  if (freq === 'monthly') newD.setMonth(newD.getMonth() + idx);
  if (freq === 'weekly') newD.setDate(newD.getDate() + idx * 7);
  return newD.toISOString();
};

export const createRecurringOrInstallments = (baseData: any) => {
  const { date, installments, frequency, isRecurring, description, amount, type, category, account, uid } = baseData;
  const baseDate = new Date(date || new Date());
  const newTransactions: any[] = [];

  if (installments && installments > 1) {
    const group = Date.now();
    for (let i = 0; i < installments; i++) {
      newTransactions.push({
        uid,
        description: description,
        amount: amount, 
        type,
        category,
        account,
        date: addDate(baseDate, i, 'monthly'),
        installmentGroup: group,
        settled: false
      });
    }
  } else if (isRecurring) {
    const count = frequency === 'weekly' ? 52 : 12;
    const recurringGroup = Date.now();
    for (let i = 0; i < count; i++) {
      newTransactions.push({
        uid,
        description: description,
        amount: amount,
        type,
        category,
        account,
        date: addDate(baseDate, i, frequency || 'monthly'),
        isRecurringEntry: true,
        recurringGroup,
        settled: false
      });
    }
  } else {
    newTransactions.push({
      uid,
      ...baseData,
      date: baseDate.toISOString(),
      settled: baseData.settled || false
    });
  }
  return newTransactions;
};
