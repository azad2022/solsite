const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(input:Uint8Array):string{
  let value=0n;
  for(const byte of input)value=(value<<8n)|BigInt(byte);
  let encoded='';
  while(value>0n){
    const remainder=Number(value%58n);
    encoded=ALPHABET[remainder]+encoded;
    value/=58n;
  }
  let leadingZeroBytes=0;
  for(const byte of input){
    if(byte!==0)break;
    leadingZeroBytes+=1;
  }
  return ALPHABET[0].repeat(leadingZeroBytes)+(encoded||'');
}
