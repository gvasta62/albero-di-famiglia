// Collegamento al database. Si compila una volta sola, dopo aver creato il progetto Supabase.
// Se i due campi restano vuoti l'app parte in "modalita' prova" con una famiglia inventata.
window.ALBERO_CONFIG = {
  supabaseUrl: '',   // es. 'https://abcdefgh.supabase.co'
  supabaseKey: ''    // la chiave "anon" / "publishable": e' pubblica per costruzione, non e' un segreto
};
