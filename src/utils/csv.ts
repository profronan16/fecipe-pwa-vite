import Papa from 'papaparse'
export async function parseCSV(file:File){
  return new Promise((resolve,reject)=>{
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res)=> resolve(res.data),
      error: reject
    })
  })
}
