import { useState, useEffect } from "react";

function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/customers?page=1&page_size=20")
      .then((response) => response.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      {loading ? (
        <p> Loading ....</p>
      ) : (
        <table>
          <caption>Customers</caption>
          <tr>
            <th>id</th>
            <th>firstname</th>
            <th>lastname</th>
            <th>email</th>
            <th>phone</th>
            <th>region</th>
          </tr>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.id}</td>
              <td>{customer.firstname}</td>
              <td>{customer.lastname}</td>
              <td>{customer.email}</td>
              <td>{customer.phone}</td>
              <td>{customer.region}</td>
            </tr>
          ))}
        </table>
      )}
    </div>
  );
}

export default App;
