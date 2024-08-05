export const bytesToString=(arr:Uint8Array):string=>{
  return Array.from(arr).map((byte)=>String.fromCharCode(byte)).join('');
}


export const xadd = (args: string[]) => {

}