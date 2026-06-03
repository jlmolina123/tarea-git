package athleticrace;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public class AthleticRaceInterface extends JFrame implements ActionListener {
    private JTextField txtNombre;
    private JButton btnRegistrar, btnIniciar, btnReiniciar, btnTerminar;
    private JTextArea txtRegistrados, txtLlegada;
    private Runner[] corredores;
    private int contador;
    private boolean carreraIniciada;

    public AthleticRaceInterface() {
        setTitle("Carrera Atlética");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLayout(new BorderLayout(10, 10));
        setSize(500, 450);
        setLocationRelativeTo(null);

        corredores = new Runner[5];
        contador = 0;
        carreraIniciada = false;

        inicializarComponentes();
    }

    private void inicializarComponentes() {
        JPanel panelNorte = new JPanel(new FlowLayout());
        JLabel lblNombre = new JLabel("Nombre del Corredor:");
        txtNombre = new JTextField(15);
        btnRegistrar = new JButton("Registrar");

        panelNorte.add(lblNombre);
        panelNorte.add(txtNombre);
        panelNorte.add(btnRegistrar);

        JPanel panelCentro = new JPanel(new BorderLayout());
        JLabel lblRegistrados = new JLabel("Corredores Registrados:");
        txtRegistrados = new JTextArea(10, 20);
        txtRegistrados.setEditable(false);
        JScrollPane scrollRegistrados = new JScrollPane(txtRegistrados);

        panelCentro.add(lblRegistrados, BorderLayout.NORTH);
        panelCentro.add(scrollRegistrados, BorderLayout.CENTER);

        JPanel panelSur = new JPanel(new BorderLayout(5, 5));
        JLabel lblLlegada = new JLabel("Orden de Llegada a la Meta:");
        txtLlegada = new JTextArea(8, 20);
        txtLlegada.setEditable(false);
        JScrollPane scrollLlegada = new JScrollPane(txtLlegada);

        JPanel panelBotones = new JPanel(new GridLayout(1, 3, 10, 10));
        btnIniciar = new JButton("Iniciar Carrera");
        btnReiniciar = new JButton("Reiniciar");
        btnTerminar = new JButton("Terminar");

        btnIniciar.setEnabled(false);
        btnReiniciar.setEnabled(false);

        panelBotones.add(btnIniciar);
        panelBotones.add(btnReiniciar);
        panelBotones.add(btnTerminar);

        panelSur.add(lblLlegada, BorderLayout.NORTH);
        panelSur.add(scrollLlegada, BorderLayout.CENTER);
        panelSur.add(panelBotones, BorderLayout.SOUTH);

        add(panelNorte, BorderLayout.NORTH);
        add(panelCentro, BorderLayout.CENTER);
        add(panelSur, BorderLayout.SOUTH);

        btnRegistrar.addActionListener(this);
        btnIniciar.addActionListener(this);
        btnReiniciar.addActionListener(this);
        btnTerminar.addActionListener(this);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        Object fuente = e.getSource();

        if (fuente == btnRegistrar) {
            registrarCorredor();
        } else if (fuente == btnIniciar) {
            iniciarCarrera();
        } else if (fuente == btnReiniciar) {
            reiniciarCarrera();
        } else if (fuente == btnTerminar) {
            System.exit(0);
        }
    }

    private void registrarCorredor() {
        String nombre = txtNombre.getText().trim();

        if (nombre.isEmpty()) {
            JOptionPane.showMessageDialog(this, "El nombre no puede estar vacío.",
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        if (contador >= 5) {
            JOptionPane.showMessageDialog(this, "Ya se registraron los 5 corredores permitidos.",
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        Runner runner = new Runner(nombre);
        corredores[contador] = runner;
        contador++;

        txtRegistrados.append("Corredor " + contador + ": " + runner.getName() +
                " (Velocidad: " + runner.getSpeed() + ")\n");

        txtNombre.setText("");
        txtNombre.requestFocus();

        if (contador >= 2) {
            btnIniciar.setEnabled(true);
            btnReiniciar.setEnabled(true);
        }

        JOptionPane.showMessageDialog(this, "Corredor registrado exitosamente.\n" +
                "participantes: " + contador + "/5", "Éxito", JOptionPane.INFORMATION_MESSAGE);
    }

    private void iniciarCarrera() {
        if (contador < 2) {
            JOptionPane.showMessageDialog(this, "Debe registrar al menos 2 corredores.",
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        btnRegistrar.setEnabled(false);
        btnIniciar.setEnabled(false);
        btnReiniciar.setEnabled(false);
        txtLlegada.setText("");
        carreraIniciada = true;

        JOptionPane.showMessageDialog(this, "¡La carrera ha comenzado!", "Carrera",
                JOptionPane.INFORMATION_MESSAGE);

        new Thread(() -> {
            Runner[] ordenLlegada = new Runner[contador];
            boolean[] llegada = new boolean[contador];
            int[] posicion = {0};

            for (int i = 0; i < contador; i++) {
                final int index = i;
                new Thread(() -> {
                    try {
                        int tiempo = 1000 + (int) (Math.random() * 2000);
                        tiempo = tiempo - (corredores[index].getSpeed() * 20);
                        if (tiempo < 500) {
                            tiempo = 500;
                        }
                        Thread.sleep(tiempo);

                        synchronized (llegada) {
                            if (!llegada[index]) {
                                ordenLlegada[posicion[0]] = corredores[index];
                                llegada[index] = true;

                                final int lugar = posicion[0] + 1;

                                SwingUtilities.invokeLater(() -> {
                                    txtLlegada.append("Lugar " + lugar + ": " +
                                            corredores[index].getName() + "\n");
                                });

                                posicion[0]++;

                                if (posicion[0] >= contador) {
                                    SwingUtilities.invokeLater(() -> {
                                        JOptionPane.showMessageDialog(null,
                                                "¡La carrera ha terminado!", "Fin de Carrera",
                                                JOptionPane.INFORMATION_MESSAGE);
                                    });
                                }
                            }
                        }
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    }
                }).start();
            }
        }).start();
    }

    private void reiniciarCarrera() {
        contador = 0;
        corredores = new Runner[5];
        carreraIniciada = false;

        txtNombre.setText("");
        txtRegistrados.setText("");
        txtLlegada.setText("");

        btnRegistrar.setEnabled(true);
        btnIniciar.setEnabled(false);
        btnReiniciar.setEnabled(false);

        JOptionPane.showMessageDialog(this, "Carrera reiniciada. Puede registrar nuevos corredores.",
                "Reiniciar", JOptionPane.INFORMATION_MESSAGE);
    }

    public static void main(String[] args) {
        try {
            UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName());
        } catch (Exception e) {
            e.printStackTrace();
        }

        SwingUtilities.invokeLater(() -> {
            AthleticRaceInterface interfaz = new AthleticRaceInterface();
            interfaz.setVisible(true);
        });
    }
}