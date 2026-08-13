export interface Entity {
  id: string;
  name: string;
  domain: 'light' | 'ac' | 'tv' | 'switch' | 'sensor';
  state: string;
  attributes: Record<string, any>;
  lastUpdated: number;
}

export class EntityStore {
  private map = new Map<string, Entity>();

  set(entity: Entity) {
    this.map.set(entity.id, entity);
  }

  get(id: string) {
    return this.map.get(id);
  }

  all() {
    return Array.from(this.map.values());
  }

  upsertState(id: string, state: string, attributes?: Record<string, any>) {
    const existing = this.map.get(id);
    if (!existing) throw new Error(`Unknown entity: ${id}`);
    existing.state = state;
    if (attributes) existing.attributes = { ...existing.attributes, ...attributes };
    existing.lastUpdated = Date.now();
  }
}

export const entityStore = new EntityStore();
