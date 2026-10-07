const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(input:Uint8Array):string{
  if(input.length===0)return '';
  const digits:number[]=[0];
  for(const byte of input){
    let carry=byte;
    for(let i=0;i<digits.length;i+=1){
      const value=digits[i]*256+carry;
      digits[i]=value%58;
      carry=Math.floor(value/58);
    }
    while(carry>0){
      digits.push(carry%58);
      carry=Math.floor(carry/58);
    }
  }
  let result='';
  for(const byte of input){
    if(byte!==0)break;
    result+=ALPHABET[0];
  }
  for(let i=digits.length-1;i>=0;i-=1)result+=ALPHABET[digits[i]];
  return result;
}
