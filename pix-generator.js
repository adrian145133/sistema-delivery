// GERADOR OFICIAL DE PIX DO BANCO CENTRAL DO BRASIL (PADRÃO BR CODE / EMVCo)
// 100% CLIENT-SIDE E OFFLINE (ZERO APIS DE BANCO)

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePixBRCode({ pixKey, merchantName, merchantCity, amount, txid }) {
  if (!pixKey) return '';
  
  // Limpeza e normalização
  const cleanKey = pixKey.trim();
  const cleanName = (merchantName || 'LOJA').normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25).toUpperCase();
  const cleanCity = (merchantCity || 'BRASIL').normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15).toUpperCase();
  const cleanTxid = (txid || 'PEDIDO' + Date.now().toString().slice(-6)).substring(0, 25);
  
  // 26: Informações da Conta do Comerciante (GUI + Chave Pix)
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', cleanKey);
  const merchantAccountInfo = formatField('26', gui + keyField);

  // 62: Dados Adicionais (txid)
  const txidField = formatField('05', cleanTxid);
  const additionalData = formatField('62', txidField);

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += merchantAccountInfo;     // Merchant Account Information
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986');  // Moeda BRL (986)
  
  if (amount && amount > 0) {
    const amountStr = Number(amount).toFixed(2);
    payload += formatField('54', amountStr); // Valor da transação
  }
  
  payload += formatField('58', 'BR');       // Código do País
  payload += formatField('59', cleanName);  // Nome do recebedor
  payload += formatField('60', cleanCity);  // Cidade do recebedor
  payload += additionalData;                // Informações adicionais
  
  // 63: CRC16
  payload += '6304';
  const checksum = crc16(payload);
  return payload + checksum;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePixBRCode };
}
