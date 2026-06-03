// Configuración de Supabase
const SUPABASE_URL = "https://wuhpdccxxdfzzxsjawkd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aHBkY2N4eGRmenp4c2phd2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODMwMTYsImV4cCI6MjA5MDc1OTAxNn0.c4fLV8v_-wET1rtvNONv1qAUKwLqhKHMbE1_nzylccA";

// Cliente Supabase simple
const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  },
  
  async from(tabla) {
    return new QueryBuilder(this, tabla);
  }
};

class QueryBuilder {
  constructor(client, tabla) {
    this.client = client;
    this.tabla = tabla;
    this.filtros = [];
  }
  
  async get() {
    let url = `${this.client.url}/rest/v1/${this.tabla}`;
    if (this.filtros.length > 0) {
      url += '?' + this.filtros.join('&');
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.client.headers
    });
    
    if (!response.ok) throw new Error(await response.text());
    return { data: await response.json(), exists: () => true };
  }
  
  async select(campos, opciones = {}) {
    let url = `${this.client.url}/rest/v1/${this.tabla}?select=${campos}`;
    if (this.filtros.length > 0) {
      url += '&' + this.filtros.join('&');
    }
    if (opciones.count) {
      url += '&count=exact';
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.client.headers
    });
    
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const count = response.headers.get('content-range') ? parseInt(response.headers.get('content-range').split('/')[1]) : data.length;
    return { data, count, exists: () => data.length > 0 };
  }
  
  async doc(id) {
    return new DocBuilder(this.client, this.tabla, id);
  }
  
  where(campo, operador, valor) {
    this.filtros.push(`${campo}=${operador}${valor}`);
    return this;
  }
  
  order(campo, asc = true) {
    this.filtros.push(`order=${campo}${asc ? '' : '.desc'}`);
    return this;
  }
  
  limit(n) {
    this.filtros.push(`limit=${n}`);
    return this;
  }
}

class DocBuilder {
  constructor(client, tabla, id) {
    this.client = client;
    this.tabla = tabla;
    this.id = id;
  }
  
  async get() {
    const response = await fetch(`${this.client.url}/rest/v1/${this.tabla}?id=eq.${this.id}`, {
      method: 'GET',
      headers: this.client.headers
    });
    
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return { 
      exists: () => data.length > 0,
      data: () => data[0] || null
    };
  }
  
  async set(datos) {
    const response = await fetch(`${this.client.url}/rest/v1/${this.tabla}`, {
      method: 'POST',
      headers: {
        ...this.client.headers,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(datos)
    });
    
    if (!response.ok) throw new Error(await response.text());
    return { id: this.id };
  }
  
  async update(datos) {
    const response = await fetch(`${this.client.url}/rest/v1/${this.tabla}?id=eq.${this.id}`, {
      method: 'PATCH',
      headers: {
        ...this.client.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });
    
    if (!response.ok) throw new Error(await response.text());
    return true;
  }
}

// db simulado para compatibilidad
const db = {
  collection: (nombre) => {
    return {
      doc: (id) => new DocBuilder(supabase, nombre, id),
      orderBy: (campo, dir) => {
        const q = new QueryBuilder(supabase, nombre);
        q.filtros.push(`order=${campo}${dir === 'desc' ? '.desc' : ''}`);
        return {
          limit: (n) => {
            q.filtros.push(`limit=${n}`);
            return q;
          },
          get: async () => {
            const res = await q.get();
            return {
              forEach: (fn) => res.data.forEach(fn),
              empty: () => res.data.length === 0,
              docs: res.data.map(d => ({ data: () => d, id: d.id }))
            };
          }
        };
      },
      get: async () => {
        const res = await new QueryBuilder(supabase, nombre).get();
        return {
          forEach: (fn) => res.data.forEach(fn),
          empty: () => res.data.length === 0,
          docs: res.data.map(d => ({ data: () => d, id: d.id }))
        };
      }
    };
  }
};
