import React from 'react';
import { Tab, Tabs } from 'react-bootstrap';

const Suppliers = () => {
  return (
    <Tabs defaultActiveKey="genel" id="supplier-tabs">
      <Tab eventKey="genel" title="Genel">
        <h2>Genel Suppliers</h2>
        {/* General Suppliers Order Management Section */}
        <p>Order Management for Genel Suppliers</p>
      </Tab>
      <Tab eventKey="pelet" title="Pelet">
        <h2>Pelet Suppliers</h2>
        {/* Pelet Suppliers Order Management Section */}
        <p>Order Management for Pelet Suppliers</p>
      </Tab>
      <Tab eventKey="boruted" title="BoruTed">
        <h2>BoruTed Suppliers</h2>
        {/* BoruTed Suppliers Order Management Section */}
        <p>Order Management for BoruTed Suppliers</p>
      </Tab>
    </Tabs>
  );
};

export default Suppliers;
