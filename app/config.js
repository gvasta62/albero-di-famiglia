// Collegamento al database. Si compila una volta sola, dopo aver creato il progetto Supabase.
// Se i due campi restano vuoti l'app parte in "modalita' prova" con una famiglia inventata.
window.ALBERO_CONFIG = {
  supabaseUrl: 'https://elmvqzftepsvharujrms.supabase.co',   // es. 'https://abcdefgh.supabase.co'
  supabaseKey: 'sb_publishable_QV7FteCoTAzxAaS1s0oyDA_8FKU5JKN'    // la chiave "anon" / "publishable": e' pubblica per costruzione, non e' un segreto
};
