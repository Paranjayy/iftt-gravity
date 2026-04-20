import fs from 'fs';
import path from 'path';

export interface CodexMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: string;
  attachmentUrl?: string;
  isPinned?: boolean;
}

export interface CodexChat {
  id: string;
  participants: any[];
  messages: CodexMessage[];
}

export class CodexSDK {
  private data: CodexChat[] = [];
  private dataPath: string;

  constructor(importPath: string) {
    this.dataPath = importPath;
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        this.data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
        console.log(`📚 Codex SDK: Indexed ${this.data.reduce((acc, c) => acc + c.messages.length, 0)} messages from ${this.data.length} chats.`);
      }
    } catch (e) {
      console.error('Failed to load Codex data:', e);
    }
  }

  public search(query: string, limit = 5): CodexMessage[] {
    const results: CodexMessage[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const chat of this.data) {
      for (const msg of chat.messages) {
        if (msg.content.toLowerCase().includes(lowerQuery)) {
          results.push(msg);
          if (results.length >= limit) return results;
        }
      }
    }
    return results;
  }

  public getPinned(): CodexMessage[] {
    const results: CodexMessage[] = [];
    for (const chat of this.data) {
      for (const msg of chat.messages) {
        if (msg.isPinned) results.push(msg);
      }
    }
    return results;
  }

  public getStats() {
    const stats = {
      totalMessages: 0,
      totalChats: this.data.length,
      mediaCounts: {} as Record<string, number>,
      participants: new Set<string>()
    };

    for (const chat of this.data) {
      stats.totalMessages += chat.messages.length;
      chat.participants.forEach(p => stats.participants.add(p.name));
      for (const msg of chat.messages) {
        stats.mediaCounts[msg.type] = (stats.mediaCounts[msg.type] || 0) + 1;
      }
    }

    return {
      ...stats,
      participants: Array.from(stats.participants)
    };
  }
}
