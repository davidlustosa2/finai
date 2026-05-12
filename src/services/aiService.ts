export class AIService {
  static async interpretCommand(message: string) {
    try {
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!response.ok) throw new Error('Proxy failed');
      return await response.json();
    } catch (e: any) {
      console.error("AI Service Error:", e);
      return { error: "Não consegui entender o comando ou houve um problema na conexão." };
    }
  }

  static async generateInsights(data: any) {
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      if (!response.ok) {
        if (response.status === 429) return { insights: [], error: 'quota_exceeded' };
        throw new Error('Proxy failed');
      }
      return await response.json();
    } catch (e: any) {
      console.error("AI Insight Error:", e);
      return { insights: [], error: "error" };
    }
  }
}
