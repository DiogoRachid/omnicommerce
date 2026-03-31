/**
 * Serviço centralizado para comunicação com o Superagent do Bling
 * Agent ID: 69c2868206172b3f55e13887
 */
import { base44 } from '@/api/base44Client';

// Agente interno do app com acesso ao BlingToken
const AGENT_NAME = 'bling_integration';

/**
 * Envia um comando ao agente e aguarda a resposta completa.
 * Retorna o conteúdo da última mensagem do agente.
 */
export async function askBlingAgent(prompt) {
  const conversation = await base44.agents.createConversation({
    agent_name: AGENT_NAME,
  });

  return new Promise((resolve, reject) => {
    let resolved = false;

    const unsubscribe = base44.agents.subscribeToConversation(
      conversation.id,
      (data) => {
        const messages = data.messages || [];
        const lastMsg = messages[messages.length - 1];

        // Quando o agente responder (role=assistant e não estiver vazio)
        if (lastMsg?.role === 'assistant' && lastMsg?.content && !resolved) {
          // Verifica se não há tool calls ainda em execução
          const hasRunningTools = (lastMsg.tool_calls || []).some(
            (tc) => tc.status === 'running' || tc.status === 'in_progress'
          );
          if (!hasRunningTools) {
            resolved = true;
            unsubscribe();
            resolve(lastMsg.content);
          }
        }
      }
    );

    base44.agents.addMessage(conversation, {
      role: 'user',
      content: prompt,
    }).catch((err) => {
      unsubscribe();
      reject(err);
    });

    // Timeout de segurança: 120s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        reject(new Error('Timeout: o agente não respondeu em 120 segundos.'));
      }
    }, 120000);
  });
}

/**
 * Envia um comando ao agente esperando JSON estruturado como resposta.
 * @param {string} prompt
 * @returns {Promise<any>} objeto JSON parseado
 */
export async function askBlingAgentJSON(prompt) {
  const raw = await askBlingAgent(prompt);

  // 1. Tenta extrair bloco ```json ... ``` ou ``` ... ```
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }

  // 2. Tenta extrair array JSON diretamente
  const arrayMatch = raw.match(/(\[[\s\S]*\])/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[1]); } catch {}
  }

  // 3. Tenta extrair objeto JSON diretamente
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch) {
    try { return JSON.parse(objMatch[1]); } catch {}
  }

  // 4. Tenta parsear o raw inteiro
  try { return JSON.parse(raw.trim()); } catch {}

  // 5. Retorna o texto como string para o chamador decidir o que fazer
  return raw.trim();
}