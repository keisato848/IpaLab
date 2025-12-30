fetch('http://localhost:3001/api/exams')
    .then(res => res.json())
    .then(data => {
        console.log('Count:', data.length);
        data.forEach(e => console.log(`ID: ${e.id} | CAT: ${e.category} | TITLE: ${e.title}`));
    })
    .catch(e => console.error(e));
